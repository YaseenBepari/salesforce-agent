import json
from fastapi import FastAPI, Request, HTTPException, status, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import uvicorn

from .database import get_audit_logs, get_chat_history, save_chat_message, log_audit_event, update_audit_log_status
from .oauth import get_auth_url, handle_oauth_callback, register_direct_session, list_active_sessions
from .salesforce_client import SalesforceClient
from .agents import execute_llm_stream

app = FastAPI(
    title="AI-Powered Salesforce Copilot",
    description="Intelligent Salesforce Sidebar Assistant Backend Services",
    version="1.0.0"
)

# Enable CORS for frontend development server and Chrome extensions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows standard local frontend and extension origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- REQUEST BODY MODEL SCHEMAS ---
class DirectSessionRequest(BaseModel):
    instance_url: str = Field(..., description="Salesforce Instance URL (e.g. https://my-dev-ed.lightning.force.com)")
    access_token: str = Field(..., description="Active access token or session ID")

class ChatQueryRequest(BaseModel):
    org_id: str = Field(..., description="Salesforce organization identifier")
    session_id: str = Field(..., description="Session identifier for thread context")
    query: str = Field(..., description="Natural language question to post")
    current_page: Dict[str, Any] = Field(default_factory=dict, description="Metadata schema of the active UI context")

class ActionApprovalRequest(BaseModel):
    log_id: int = Field(..., description="Database transaction audit log reference ID")
    org_id: str = Field(..., description="Salesforce Organization identifier")
    action_type: str = Field(..., description="Categorized admin action to approve")
    payload: Dict[str, Any] = Field(..., description="Structured execution variables")

class ActionRejectRequest(BaseModel):
    log_id: int = Field(..., description="Database transaction audit log reference ID")
    reason: Optional[str] = Field(default="Rejected by User", description="Decline rationale explanation")

# --- ENDPOINTS ---

@app.get("/api/health")
def health_check():
    """
    Standard service availability healthcheck endpoint.
    """
    return {"status": "healthy", "service": "Salesforce Copilot Backend", "database": "SQLite Online"}

@app.get("/api/sessions")
def get_sessions():
    """
    Lists active Salesforce sessions configured.
    """
    return {"sessions": list_active_sessions()}

@app.post("/api/sessions/direct")
def connect_direct(payload: DirectSessionRequest):
    """
    Registers a Salesforce session directly utilizing a session ID and instance URL.
    """
    try:
        session = register_direct_session(payload.instance_url, payload.access_token)
        return {"success": True, "session": session}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=f"Connection attempt failed: {str(e)}"
        )

@app.get("/api/oauth/login")
def oauth_login(env_type: str = "production", state: Optional[str] = None):
    """
    Redirects user to standard Salesforce OAuth authorize landing.
    """
    auth_url = get_auth_url(env_type, state)
    return RedirectResponse(auth_url)

@app.get("/api/oauth/callback")
def oauth_callback(code: str, state: str):
    """
    Callback landing receiving authorization code.
    """
    try:
        env_type = state if state in ["production", "sandbox"] else "production"
        session = handle_oauth_callback(code, env_type)
        # Redirect to React frontend dashboard on success
        return RedirectResponse(url=f"http://localhost:5173/?connected=true&org_id={session['org_id']}")
    except Exception as e:
        return RedirectResponse(url=f"http://localhost:5173/?connected=false&error={str(e)}")

# --- CONVERSATIONAL AI & STREAMING ---

@app.post("/api/chat/query")
async def chat_query(payload: ChatQueryRequest):
    """
    Streams Server-Sent Events (SSE) yielding the active multi-agent AI response.
    """
    # 1. Create client instance
    client = SalesforceClient(payload.org_id)
    
    # 2. Extract thread history
    history = get_chat_history(payload.org_id, payload.session_id)
    
    # 3. Log user input message
    save_chat_message(payload.org_id, payload.session_id, "user", payload.query)
    
    # 4. Generate SSE Generator
    def sse_generator():
        # First yield the log ID in case an action is triggered or to confirm receipt
        yield f"data: {json.dumps({'status': 'processing'})}\n\n"
        
        full_response = ""
        action_packet = None
        
        # Pull chunks
        for chunk in execute_llm_stream(client, payload.current_page, payload.query, history):
            # Parse chunk data
            if chunk.startswith("data: "):
                data_str = chunk[6:].strip()
                try:
                    data_obj = json.loads(data_str)
                    # If LLM proposed a safe action execution
                    if data_obj.get("action") == "APPROVAL_REQUIRED":
                        action_packet = data_obj
                    elif data_obj.get("content"):
                        full_response += data_obj["content"]
                except:
                    pass
            yield chunk
            
        # Write final text response to SQLite history database
        if full_response:
            save_chat_message(payload.org_id, payload.session_id, "assistant", full_response)
            
        # If an action was proposed, write a PENDING record to the database audit logs
        if action_packet:
            username = client.session["username"] if not client.is_simulated else "Developer User"
            log_id = log_audit_event(
                org_id=payload.org_id,
                username=username,
                action_type=action_packet["action_type"],
                description=action_packet["description"],
                target_object=payload.current_page.get("objectName", "sObject"),
                status="PENDING"
            )
            # Emit the database Log ID to frontend so it can link button approvals
            action_packet["log_id"] = log_id
            yield f"data: {json.dumps(action_packet)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.get("/api/chat/history")
def get_history(org_id: str, session_id: str):
    """
    Returns full history thread of a session.
    """
    return {"history": get_chat_history(org_id, session_id)}

# --- SAFE ACTION EXECUTION LAYER ---

@app.get("/api/audit/logs")
def get_audits(org_id: Optional[str] = None):
    """
    Returns audit tracking operations lists.
    """
    return {"logs": get_audit_logs(org_id)}

@app.post("/api/actions/approve")
def approve_action(payload: ActionApprovalRequest):
    """
    Admin approval handler. Executes the requested configuration change against Salesforce APIs
    or simulates it, updating the transaction status and writing detailed audit records.
    """
    client = SalesforceClient(payload.org_id)
    executor_name = client.session["username"] if not client.is_simulated else "Developer User"
    
    print(f"[SAFETY GATE] Processing APPROVAL for {payload.action_type} (Log Reference: {payload.log_id})")
    
    try:
        result = {}
        # 1. Route actions
        if payload.action_type == "CREATE_USER":
            result = client.create_user(payload.payload)
            success_msg = f"Successfully created Salesforce User with Username: {payload.payload.get('Username')}"
            
        elif payload.action_type == "ASSIGN_PERMISSION_SET":
            result = client.assign_permission_set(
                payload.payload.get("userId"), 
                payload.payload.get("permissionSetId")
            )
            success_msg = f"Successfully assigned Permission Set ID: {payload.payload.get('permissionSetId')} to User ID: {payload.payload.get('userId')}"
            
        elif payload.action_type == "CLONE_PERMISSIONS":
            result = client.clone_permissions(
                payload.payload.get("sourceUserId"), 
                payload.payload.get("targetUserId")
            )
            success_msg = f"Successfully cloned {len(result)} permissions to User ID: {payload.payload.get('targetUserId')}"
            
        elif payload.action_type == "RUN_SOQL":
            result = client.query(payload.payload.get("query"))
            success_msg = f"Executed SOQL query successfully. Retrieved {len(result.get('records', []))} records."
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Unrecognized Action type: {payload.action_type}"
            )
            
        # 2. Update audit record on success
        update_audit_log_status(payload.log_id, status="APPROVED", approved_by=executor_name)
        
        return {
            "success": True, 
            "message": success_msg, 
            "log_id": payload.log_id,
            "details": result
        }
        
    except Exception as e:
        update_audit_log_status(payload.log_id, status="FAILED", approved_by=executor_name)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Action execution crashed: {str(e)}"
        )

@app.post("/api/actions/reject")
def reject_action(payload: ActionRejectRequest):
    """
    Decline handler setting action status to REJECTED.
    """
    print(f"[SAFETY GATE] Processing DECLINE/REJECT (Log Reference: {payload.log_id})")
    update_audit_log_status(payload.log_id, status="REJECTED")
    return {"success": True, "message": "Action rejected successfully", "log_id": payload.log_id}

# --- LAUNCH COORD ---
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
