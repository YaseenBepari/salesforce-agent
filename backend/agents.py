import os
import json
from typing import Dict, Any, List, Generator, Optional
from openai import OpenAI
from anthropic import Anthropic
from .salesforce_client import SalesforceClient
from .database import log_audit_event, save_chat_message

# We load environment variables for API keys
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# --- SPECIALIZED AGENT SYSTEM PROMPTS ---
SYSTEM_PROMPTS = {
    "orchestrator": """You are Antigravity, an elite AI Salesforce Copilot sidebar assistant.
Your goal is to help Admins, Developers, and Architects understand, explain, troubleshoot, and automate their Salesforce Orgs.
Active Org Context: {org_context}
Current Screen State: {screen_context}

You have access to specialized modes of reasoning:
- **Metadata Analysis**: Explaining schemas, validation rule formulas, fields.
- **Apex Code Review**: Tracing triggers, bulkification, code optimization.
- **Permission Auditing**: Comparing user access, assigning permission sets.
- **SOQL Generation**: Generating clean, safe, valid queries.
- **Automation Troubleshooting**: Order of execution, Flow configurations.

Always provide structured, elegant responses using markdown. If you need to perform an action (like creating a user, assigning permission sets, cloning permissions, or running a query), format it as an ACTION block so the security layer can capture it.""",
    
    "metadata": "You are the Metadata Analysis Agent. Focus on analyzing object schemas, field definitions, validation rules, page layouts, and formula logic. Point out formula errors or potential data integrity risks.",
    "apex": "You are the Apex Code Consultant. Focus on reviewing Apex classes, triggers, and test coverage. Look for anti-patterns: DML inside loops, lack of bulkification, recursion triggers, and SOQL in loops.",
    "security": "You are the Security & Permission Auditor. Review profiles, permission sets, field-level security, role sharing, and user visibility. Analyze why a user might be blocked from seeing a record.",
    "soql": "You are the SOQL Optimizer. Formulate high-performance Salesforce queries. Ensure queries do not use forbidden wildcard operations and always target indexed fields when filtering large tables.",
    "automation": "You are the Automation Architect. Analyze record-triggered flows, process builders, and order of execution. Detail how flows interact with Apex triggers."
}

def build_context_strings(org_client: SalesforceClient, current_page: Dict[str, Any]) -> tuple:
    """
    Constructs high-fidelity context logs for the AI to understand the current org and screen states.
    """
    # 1. Org Info
    if org_client.is_simulated:
        org_context = "Running in Simulated Sandbox Mode (Org ID: 00D80000000abcd, Dev Sandbox CS42)."
    else:
        try:
            org_info = org_client.query("SELECT Name, Id, OrganizationType, InstanceName FROM Organization")["records"][0]
            org_context = f"Real Org: {org_info['Name']} (ID: {org_info['Id']}, Type: {org_info['OrganizationType']}, Instance: {org_info['InstanceName']})"
        except:
            org_context = "Connected to Real Salesforce Org (details unavailable)."

    # 2. Screen Info
    page_type = current_page.get("type", "Home")
    object_name = current_page.get("objectName", "")
    record_id = current_page.get("recordId", "")
    
    screen_context = f"Page Type: {page_type}."
    if object_name:
        screen_context += f" Object Context: {object_name}."
    if record_id:
        screen_context += f" Active Record ID: {record_id}."
        
    # Inject active metadata content if viewing code or automation in the simulator
    if page_type == "ApexClass" and current_page.get("name"):
        screen_context += f"\nViewing Apex Class: {current_page.get('name')}\nCode Content:\n```java\n{current_page.get('body')}\n```"
    elif page_type == "ApexTrigger" and current_page.get("name"):
        screen_context += f"\nViewing Apex Trigger: {current_page.get('name')}\nCode Content:\n```java\n{current_page.get('body')}\n```"
    elif page_type == "Flow" and current_page.get("name"):
        screen_context += f"\nViewing Flow: {current_page.get('name')}\nFlow Properties: {json.dumps(current_page.get('nodes'))}"
    elif page_type == "RecordDetail" and object_name:
        screen_context += f"\nViewing Record Details of {object_name}. Available validation rules: {json.dumps(current_page.get('validationRules', []))}"
        
    return org_context, screen_context

def route_query_to_agent(query: str) -> str:
    """
    Routes the query to a specialized agent depending on the keywords.
    """
    q = query.lower()
    # Check automation/flow first to prevent "record-triggered flow" from colliding with apex triggers
    if any(k in q for k in ["flow", "process", "workflow", "order", "automation"]):
        return "automation"
    elif any(k in q for k in ["trigger", "apex", "class", "handler", "loop", "bulkify", "code"]):
        return "apex"
    elif any(k in q for k in ["permission", "sharing", "fls", "role", "clone", "assign"]) or ("access" in q and "soql" not in q and "select" not in q) or ("profile" in q and "options" not in q and "configure" not in q and "user" not in q) or ("user" in q and "configure" not in q and "options" not in q):
        return "security"
    elif any(k in q for k in ["soql", "query", "select", "database"]):
        return "soql"
    elif any(k in q for k in ["field", "validation", "formula", "object", "schema", "describe"]):
        return "metadata"
    return "orchestrator"

def get_simulated_ai_response(agent_type: str, query: str, screen_context: str) -> str:
    """
    Generates intelligent offline mock responses to provide a gorgeous experience immediately
    without requiring external APIs keys on initial run.
    """
    q = query.lower()
    
    # Apex review
    if agent_type == "apex":
        if "recursion" in q or "bug" in q or "explain" in q:
            return """### Apex Code Analysis: `DiscountHandler` & `OpportunityTrigger`

I've reviewed the Apex trigger and its handler class in your active workspace context.

#### 1. Execution Flow & Architecture
* **Trigger (`OpportunityTrigger`)**: Configured to run `before insert` and `before update`. It forwards the records directly to `DiscountHandler.applyVIPDiscounts()`.
* **Handler (`DiscountHandler`)**: Extracts parent `AccountIds` to check for `VIP_Status__c = true`, then applies a **15% discount** (multiplying amount by `0.85`) and sets `Discount_Approved__c = true`.

#### 2. Trigger Recursion Warning ⚠️
In the `DiscountHandler` class, a static Boolean flag is declared to prevent recursive executions:
```java
private static Boolean hasRun = false;
```
* **The Risk**: While this prevents trigger recursion when a single update triggers another update internally, using a **static Boolean variable** like this is a severe anti-pattern in high-volume orgs.
* **Why**: If a bulk load of 400 records is executed, Salesforce splits them into batches of 200. Because the static variable persists across the transaction execution context, the static `hasRun` variable will remain `true` after the first batch! As a result, the second batch of 200 records **will bypass the VIP discounts entirely!**
* **Recommendation**: Replace this static recursion guard with a Set-based ID tracker (`Set<Id> processedIds`) or use a robust Trigger Handler Framework that controls phase execution correctly.

Would you like me to draft an updated `DiscountHandler` class with a bulk-safe trigger recursion implementation?"""

    # Security audits
    elif agent_type == "security":
        if "permission" in q or "access" in q or "clone" in q:
            return """### Salesforce Security & Permission Audit

Based on the active Org setup, I've checked user access configurations.

#### Active Security Profile Details:
* **System Administrator**: Full read/write/delete metadata access. Has the `Apex_Compiler_Permission` and `Territory_Manager_Permission` assigned.
* **Sales Representative**: Read/write access on standard Opportunity and Account tables. Has the `Territory_Manager_Permission` assigned, but **does not** possess Apex Code Deployment privileges.

#### Access Simulation:
* **Case**: A Sales Rep is trying to deploy an Apex Trigger but gets blocked.
* **Reason**: They do not have the custom Permission Set `Apex_Compiler_Permission` assigned, which grants `Author Apex` privileges.
* **Solution**: You can assign the permission set using the Copilot. 

*Suggested Admin Action:*
* **Assign Permission Set**: Select **Sales Representative** and assign the `Apex_Compiler_Permission`.

*(Click one of the suggested quick action buttons below to simulate user provisioning!)*"""

    # Flow audits
    elif agent_type == "automation":
        return """### Flow Visualizer & Order of Execution Analysis

I've analyzed the **Opportunity VIP Discount Automation** (`Opportunity_Auto_Discount_Flow`) record-triggered flow.

#### 1. Flow Schema Breakdown:
* **Trigger Type**: `RecordBeforeSave` (Fast Field Updates). Runs **before** Apex triggers and before the record is saved to the database.
* **Condition Path**:
  1. **Start Node**: Fires when an Opportunity is created or updated.
  2. **Decision Node (`Dec_VIP_Check`)**: Checks if the parent Account has `VIP_Status__c = true`.
  3. **Action Node (`Yes_VIP`)**: Updates `Discount_Approved__c` to `True`.
  4. **End Node**: Concludes transaction control.

#### 2. Order of Execution Conflict Alert 🚨
* There is a direct conflict between the **Flow VIP Automation** and the **Apex `DiscountHandler`**:
  * Both components check for VIP accounts and apply discount status or change fields on `Opportunity`.
  * **Flow (Before-Save)** runs *before* the **Apex Trigger (Before Update)**.
  * In `DiscountHandler`, the VIP account query executes:
    `SELECT Id, VIP_Status__c FROM Account WHERE Id IN :accIds AND VIP_Status__c = true`
    and modifies the `Amount` field by 15%.
  * **Result**: You have redundant metadata logic! Having both before-save flows and before-save triggers modifying the same fields creates testing complexity and performance overhead.
  * **Recommendation**: Consolidate the VIP discount logic. Since before-save flows are faster and don't consume SOQL limits, consider migrating the VIP field mapping fully into the Flow, and deprecate the `DiscountHandler` VIP class completely.

Would you like me to generate an analysis report comparing the performance of both implementations?"""

    # SOQL queries
    elif agent_type == "soql":
        return """### SOQL Query Generation & Optimization

Based on your prompt, here is a highly optimized, safe SOQL query to fetch premium Account records:

```sql
SELECT Id, Name, AnnualRevenue, Industry, VIP_Status__c 
FROM Account 
WHERE VIP_Status__c = true 
  AND AnnualRevenue >= 1000000 
ORDER BY AnnualRevenue DESC 
LIMIT 100
```

#### Query Characteristics:
* **Selective Filter**: It filters on `VIP_Status__c = true` and `AnnualRevenue >= 1000000`. In a large database, these fields should be marked as **External ID** or **Indexed** to guarantee high performance under standard sharing rules.
* **DML Protection**: This is a read-only query and contains no data manipulation verbs.

Would you like me to explain the execution pathway or run this query against your active org?"""

    # Metadata queries
    elif agent_type == "metadata":
        return """### Metadata & Schema Analysis: `Account.Require_VIP_Revenue` Validation Rule

Here is the breakdown of the validation rule configured on the `Account` object:

#### Rule Properties:
* **Rule Name**: `Require_VIP_Revenue`
* **Active Status**: Active (True)
* **Error Formula**:
  ```excel
  AND( VIP_Status__c = True, AnnualRevenue < 1000000 )
  ```
* **Error Message**: *"A VIP Account must have an Annual Revenue of at least $1,000,000."*

#### Logic Explanation:
* The validation rule fires when both criteria are met:
  1. `VIP_Status__c` is checked (True).
  2. `AnnualRevenue` is less than `$1,000,000` (or blank, since numerical operations treat blank as 0).
* **Troubleshooting Tip**: If this validation rule is failing unexpectedly during a lead conversion or integrations, check if the integration user has FLS (Field-Level Security) read-access on `VIP_Status__c`. If they cannot see the field, it may evaluate to `False` (bypassing the rule) or block conversion.

Would you like to examine the field-level security settings for `VIP_Status__c` across profiles?"""

    # Generic response
    return """### AI Salesforce Copilot

Hello! I am your Antigravity Copilot. I'm connected to your active Salesforce sandbox context and analyzing the metadata schemas.

You can ask me questions about:
1. **Apex Triggers & Handlers**: e.g., *"Explain the recursive bug in DiscountHandler"* or *"Review my OpportunityTrigger"*.
2. **Security & Permissions**: e.g., *"Who has access to the VIP Status field?"* or *"Compare permissions between Admin and Sales Rep"*.
3. **Automations & Flows**: e.g., *"What flows run on the Opportunity object?"* or *"Explain the order of execution conflicts"*.
4. **SOQL Generation**: e.g., *"Generate a query to find VIP Accounts"* or *"Run a SOQL query for me"*.

*(Use the suggestions list or write your questions directly in the input bar below!)*"""


def execute_llm_stream(org_client: SalesforceClient, current_page: Dict[str, Any], query: str, history: List[Dict[str, str]] = None) -> Generator[str, None, None]:
    """
    Executes a streaming query against Nvidia NIM, OpenAI, or Anthropic if keys are present.
    If no keys are found, it falls back to the high-performance local simulated AI responses.
    """
    # 1. Identify active agent role
    agent_type = route_query_to_agent(query)
    
    # 2. Compile contexts
    org_context, screen_context = build_context_strings(org_client, current_page)
    
    # 3. Check for API keys
    has_api = False
    
    # Let's inspect the active configuration keys
    if NVIDIA_API_KEY:
        has_api = True
        llm_type = "nvidia"
    elif OPENAI_API_KEY:
        has_api = True
        llm_type = "openai"
    elif ANTHROPIC_API_KEY:
        has_api = True
        llm_type = "anthropic"
    else:
        llm_type = "simulated"
        
    # LOGGING
    print(f"[COPILOT ROUTER] Routing query to Agent: {agent_type} (LLM Engine: {llm_type})")
    
    # We also check for actionable intents to attach quick action banners
    action_payload = None
    q_lower = query.lower()
    if "create" in q_lower and "user" in q_lower:
        action_payload = {
            "action": "APPROVAL_REQUIRED",
            "action_type": "CREATE_USER",
            "description": "Create a new simulated Salesforce user",
            "payload": {
                "Username": "new.user@antigravity.demo",
                "LastName": "SimulatedUser",
                "Email": "new.user@antigravity.demo",
                "ProfileId": "00e800000002ghi", # Standard User
                "Alias": "simuser",
                "TimeZoneSidKey": "America/Los_Angeles",
                "LocaleSidKey": "en_US",
                "EmailEncodingKey": "UTF-8",
                "LanguageLocaleKey": "en_US"
            }
        }
    elif "clone" in q_lower or "permission" in q_lower:
        action_payload = {
            "action": "APPROVAL_REQUIRED",
            "action_type": "CLONE_PERMISSIONS",
            "description": "Clone permissions from Admin to Sales Rep",
            "payload": {
                "sourceUserId": "00580000000a111", # Admin
                "targetUserId": "00580000000a222"  # Sales Rep
            }
        }
    elif "soql" in q_lower or "run" in q_lower:
        action_payload = {
            "action": "APPROVAL_REQUIRED",
            "action_type": "RUN_SOQL",
            "description": "Execute read-only SOQL query on active accounts",
            "payload": {
                "query": "SELECT Name, AnnualRevenue, VIP_Status__c FROM Account WHERE VIP_Status__c = true"
            }
        }

    # 4. Fallback if simulated
    if llm_type == "simulated":
        # Simulate typing/streaming response
        response_text = get_simulated_ai_response(agent_type, query, screen_context)
        
        # Stream the mock response
        chunk_size = 40
        for i in range(0, len(response_text), chunk_size):
            yield f"data: {json.dumps({'content': response_text[i:i+chunk_size]})}\n\n"
            
        # Yield the structured action if detected
        if action_payload:
            yield f"data: {json.dumps(action_payload)}\n\n"
            
        return

    # 5. Build prompt
    system_content = f"{SYSTEM_PROMPTS['orchestrator'].format(org_context=org_context, screen_context=screen_context)}\n\n{SYSTEM_PROMPTS[agent_type]}"
    
    messages = []
    # Inject chat history if provided
    if history:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": query})

    # 6. API call execution
    try:
        if llm_type == "nvidia":
            client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=NVIDIA_API_KEY
            )
            stream = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[{"role": "system", "content": system_content}] + messages,
                temperature=1,
                top_p=1,
                max_tokens=4096,
                stream=True
            )
            for chunk in stream:
                if not getattr(chunk, "choices", None):
                    continue
                reasoning = getattr(chunk.choices[0].delta, "reasoning_content", None)
                if reasoning:
                    yield f"data: {json.dumps({'content': reasoning})}\n\n"
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
                    
        elif llm_type == "openai":
            client = OpenAI(api_key=OPENAI_API_KEY)
            stream = client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[{"role": "system", "content": system_content}] + messages,
                stream=True
            )
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield f"data: {json.dumps({'content': content})}\n\n"
                    
        elif llm_type == "anthropic":
            client = Anthropic(api_key=ANTHROPIC_API_KEY)
            # Standard Anthropic system is a separate parameter
            with client.messages.stream(
                model="claude-3-opus-20240229",
                max_tokens=4000,
                system=system_content,
                messages=messages
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'content': text})}\n\n"
                    
    except Exception as e:
        error_msg = f"\n\n❌ **Error calling LLM Service API:** {str(e)}\n\n*Switching back to local simulated response for stability...*"
        yield f"data: {json.dumps({'content': error_msg})}\n\n"
        
        # Fallback stream
        response_text = get_simulated_ai_response(agent_type, query, screen_context)
        for i in range(0, len(response_text), 20):
            yield f"data: {json.dumps({'content': response_text[i:i+20]})}\n\n"
            
    # Yield the structured action if detected and LLM call completed
    if action_payload:
        yield f"data: {json.dumps(action_payload)}\n\n"
