import sys
import json
import time
from backend.database import init_db, log_audit_event, get_audit_logs, save_chat_message, get_chat_history
from backend.salesforce_client import SalesforceClient
from backend.agents import route_query_to_agent, get_simulated_ai_response, build_context_strings

def run_tests():
    print("==================================================")
    print("STARTING AUTOMATED COPILOT VERIFICATION TESTS")
    print("==================================================")
    
    # 1. DATABASE TESTS
    print("\n[TEST 1] Initializing SQLite database...")
    init_db()
    
    print("Saving chat message to history...")
    test_session_id = f"test_session_{int(time.time())}"
    save_chat_message("simulated_org", test_session_id, "user", "How does trigger work?")
    save_chat_message("simulated_org", test_session_id, "assistant", "Triggers process records in batches.")
    
    history = get_chat_history("simulated_org", test_session_id)
    assert len(history) == 2, f"Expected 2 messages, got {len(history)}"
    assert history[0]["role"] == "user", "First message should be from user"
    print("OK - Chat history saved and verified successfully!")
    
    print("\nLogging security audit event...")
    log_id = log_audit_event(
        org_id="simulated_org",
        username="Developer User",
        action_type="CREATE_USER",
        description="Create mock user new.user@demo.com",
        target_object="User",
        status="PENDING"
    )
    assert log_id is not None, "Expected valid log ID reference"
    
    logs = get_audit_logs("simulated_org")
    assert len(logs) > 0, "Expected at least 1 log entry"
    assert logs[0]["action_type"] == "CREATE_USER", f"Expected action_type CREATE_USER, got {logs[0]['action_type']}"
    print(f"OK - Audit logger active (Event Reference: #{log_id})!")

    # 2. CLIENT TESTS
    print("\n[TEST 2] Verifying Salesforce client simulator...")
    client = SalesforceClient("simulated_org")
    assert client.is_simulated == True, "Expected client to fall back to simulation mode"
    
    describe = client.get_object_describe("Account")
    assert describe["Label"] == "Account", "Expected Account schema describe"
    assert len(describe["ValidationRules"]) > 0, "Expected active validation rules on Account"
    print("OK - Schema describe simulation matches expected standard!")
    
    soql_res = client.query("SELECT Name, AnnualRevenue FROM Organization")
    assert len(soql_res["records"]) > 0, "Expected mock Organization records"
    assert soql_res["records"][0]["Name"] == "Antigravity Dev Sandbox", "Expected simulated org name"
    print("OK - Simulated SOQL reader returned high-fidelity outputs!")

    # 3. ROUTER TESTS
    print("\n[TEST 3] Testing specialized AI router classifiers...")
    queries_to_test = {
        "Explain the recursion guard bug in DiscountHandler class": "apex",
        "Who has access to the VIP Status field on Account?": "security",
        "Generate a SOQL query to select VIP Accounts": "soql",
        "What record-triggered flows execute on Opportunity?": "automation",
        "Describe the VIP Revenue validation rule formula": "metadata",
        "Help me configure my Salesforce profile options": "orchestrator"
      }
    
    for q, expected in queries_to_test.items():
        routed = route_query_to_agent(q)
        assert routed == expected, f"Query '{q}' routed to '{routed}', expected '{expected}'"
        print(f"  - Routed query '{q[:40]}...' -> agent: '{routed}' (OK)")
    print("OK - Keywords multi-agent routing completed perfectly!")

    # 4. SIMULATION RESPONSES VERIFICATION
    print("\n[TEST 4] Validating offline mock responses...")
    screen_ctx = "Page Type: ApexClass. Object Context: DiscountHandler"
    resp = get_simulated_ai_response("apex", "Explain the static Boolean bug", screen_ctx)
    assert "DiscountHandler" in resp, "Expected DiscountHandler reference in response"
    assert "recursion" in resp.lower(), "Expected recursion bug explanation in response"
    print("OK - Offline educational explanation engines are fully operational!")
    
    print("\n==================================================")
    print("ALL COPILOT BACKEND CHECKS COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    try:
      run_tests()
      sys.exit(0)
    except AssertionError as e:
      print(f"\nASSERTION ERROR: {str(e)}")
      sys.exit(1)
    except Exception as e:
      print(f"\nCRITICAL CRASH: {str(e)}")
      sys.exit(1)
