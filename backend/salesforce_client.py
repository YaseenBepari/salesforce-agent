import requests
from typing import Dict, Any, List, Optional
from .oauth import get_session

# --- MOCK SIMULATOR DATASET ---
# This mirrors a real Salesforce Developer Org metadata footprint for instant local testing.
MOCK_METADATA = {
    "Organization": {
        "Name": "Antigravity Dev Sandbox",
        "Id": "00D80000000abcd",
        "InstanceName": "CS42",
        "OrganizationType": "Developer Edition"
    },
    "sObjects": {
        "Account": {
            "Label": "Account",
            "DeveloperName": "Account",
            "Fields": [
                {"Name": "Id", "Type": "id", "Label": "Account ID", "Updateable": False},
                {"Name": "Name", "Type": "string", "Label": "Account Name", "Updateable": True},
                {"Name": "AnnualRevenue", "Type": "currency", "Label": "Annual Revenue", "Updateable": True},
                {"Name": "Industry", "Type": "picklist", "Label": "Industry", "Updateable": True},
                {"Name": "Rating", "Type": "picklist", "Label": "Rating", "Updateable": True},
                {"Name": "Type", "Type": "picklist", "Label": "Type", "Updateable": True},
                {"Name": "VIP_Status__c", "Type": "boolean", "Label": "VIP Status", "Updateable": True, "Description": "Custom field to mark premium accounts"}
            ],
            "ValidationRules": [
                {
                    "FullName": "Account.Require_VIP_Revenue",
                    "Active": True,
                    "ErrorConditionFormula": "AND( VIP_Status__c = True, AnnualRevenue < 1000000 )",
                    "ErrorMessage": "A VIP Account must have an Annual Revenue of at least $1,000,000.",
                    "Description": "Validates VIP status matches the revenue profile."
                },
                {
                    "FullName": "Account.Block_Prospect_Deals",
                    "Active": True,
                    "ErrorConditionFormula": "AND( ISPICKVAL(Type, 'Prospect'), AnnualRevenue > 5000000 )",
                    "ErrorMessage": "Prospect accounts cannot exceed $5,000,000 in revenue. Convert to Customer first.",
                    "Description": "Prevents large deal sizing before conversion."
                }
            ],
            "Trigger": "AccountTrigger"
        },
        "Opportunity": {
            "Label": "Opportunity",
            "DeveloperName": "Opportunity",
            "Fields": [
                {"Name": "Id", "Type": "id", "Label": "Opportunity ID", "Updateable": False},
                {"Name": "Name", "Type": "string", "Label": "Name", "Updateable": True},
                {"Name": "Amount", "Type": "currency", "Label": "Amount", "Updateable": True},
                {"Name": "StageName", "Type": "picklist", "Label": "Stage", "Updateable": True},
                {"Name": "Probability", "Type": "percent", "Label": "Probability (%)", "Updateable": True},
                {"Name": "Discount_Approved__c", "Type": "boolean", "Label": "Discount Approved", "Updateable": True}
            ],
            "ValidationRules": [
                {
                    "FullName": "Opportunity.Require_Discount_Approval",
                    "Active": True,
                    "ErrorConditionFormula": "AND( StageName = 'Closed Won', Amount > 100000, Discount_Approved__c = False )",
                    "ErrorMessage": "Deals over $100,000 must have their discount approved before closing.",
                    "Description": "Enforces risk-management for large accounts."
                }
            ],
            "Trigger": None
        }
    },
    "ApexClasses": {
        "DiscountHandler": {
            "Id": "01q800000001abc",
            "Name": "DiscountHandler",
            "ApiVersion": 59.0,
            "Body": """/**
 * @description Handles automated opportunity discounting
 * WARNING: Watch out for recursive trigger flags on bulk update!
 */
public with sharing class DiscountHandler {
    
    // Static set to prevent recursion bugs
    private static Boolean hasRun = false;
    
    public static void applyVIPDiscounts(List<Opportunity> newOpps) {
        if (hasRun) return;
        hasRun = true;
        
        Set<Id> accIds = new Set<Id>();
        for (Opportunity opp : newOpps) {
            if (opp.AccountId != null) {
                accIds.add(opp.AccountId);
            }
        }
        
        // Fetch matching Accounts and map
        Map<Id, Account> vipAccounts = new Map<Id, Account>([
            SELECT Id, VIP_Status__c, AnnualRevenue 
            FROM Account 
            WHERE Id IN :accIds AND VIP_Status__c = true
        ]);
        
        for (Opportunity opp : newOpps) {
            if (opp.AccountId != null && vipAccounts.containsKey(opp.AccountId)) {
                // Apply automatic 15% discount for VIP Accounts
                if (opp.Amount > 10000) {
                    opp.Amount = opp.Amount * 0.85;
                    opp.Discount_Approved__c = true;
                }
            }
        }
    }
}"""
        }
    },
    "ApexTriggers": {
        "OpportunityTrigger": {
            "Id": "01t800000002xyz",
            "Name": "OpportunityTrigger",
            "TableEnumOrId": "Opportunity",
            "Body": """trigger OpportunityTrigger on Opportunity (before insert, before update) {
    if (Trigger.isBefore) {
        if (Trigger.isInsert || Trigger.isUpdate) {
            // Apply corporate VIP discount rates
            DiscountHandler.applyVIPDiscounts(Trigger.new);
        }
    }
}"""
        }
    },
    "Flows": {
        "Opportunity_Auto_Discount_Flow": {
            "Id": "30180000000abc1",
            "Label": "Opportunity VIP Discount Automation",
            "DeveloperName": "Opportunity_Auto_Discount_Flow",
            "Status": "Active",
            "Type": "RecordBeforeSave",
            "TriggerObjectOrEvent": "Opportunity",
            "Description": "Automatically flags large VIP opportunity records to trigger approval workflows.",
            "Nodes": [
                {"Id": "Start", "Type": "Trigger", "Label": "Trigger when Opportunity is Created/Updated"},
                {"Id": "Dec_VIP_Check", "Type": "Decision", "Label": "Is VIP Account?", "Routes": ["Yes_VIP", "No_VIP"]},
                {"Id": "Yes_VIP", "Type": "UpdateRecord", "Label": "Set Discount Approved = True"},
                {"Id": "End", "Type": "End", "Label": "Process Ends"}
            ]
        }
    },
    "Profiles": [
        {"Id": "00e800000001def", "Name": "System Administrator"},
        {"Id": "00e800000002ghi", "Name": "Standard User"},
        {"Id": "00e800000003jkl", "Name": "Sales Representative"}
    ],
    "PermissionSets": [
        {"Id": "0PS800000001xyz", "Name": "Apex_Compiler_Permission", "Label": "Apex Code Deployment Admin"},
        {"Id": "0PS800000002uvw", "Name": "Territory_Manager_Permission", "Label": "Territory Management Operator"}
    ],
    "Users": [
        {
            "Id": "00580000000a111", 
            "Username": "admin@antigravity.demo", 
            "LastName": "Admin", 
            "Email": "admin@antigravity.demo", 
            "ProfileName": "System Administrator",
            "ProfileId": "00e800000001def", 
            "IsActive": True,
            "PermissionSets": ["Apex_Compiler_Permission", "Territory_Manager_Permission"]
        },
        {
            "Id": "00580000000a222", 
            "Username": "sales.rep@antigravity.demo", 
            "LastName": "Rep", 
            "Email": "sales.rep@antigravity.demo", 
            "ProfileName": "Sales Representative",
            "ProfileId": "00e800000003jkl", 
            "IsActive": True,
            "PermissionSets": ["Territory_Manager_Permission"]
        }
    ]
}


class SalesforceClient:
    def __init__(self, org_id: str):
        self.org_id = org_id
        self.session = get_session(org_id)
        
        # If simulated_org or no active oauth session, we flag as simulation mode
        self.is_simulated = (org_id == "simulated_org") or (self.session is None)
        
        if not self.is_simulated:
            self.instance_url = self.session["instance_url"]
            self.access_token = self.session["access_token"]
            self.headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            self.version = "v59.0"
            self.base_url = f"{self.instance_url}/services/data/{self.version}"

    # --- SOQL QUERY EXECUTION ---
    def query(self, soql: str) -> Dict[str, Any]:
        """
        Executes a standard SOQL query against Salesforce.
        """
        if self.is_simulated:
            return self._mock_soql(soql)
            
        url = f"{self.base_url}/query"
        response = requests.get(url, headers=self.headers, params={"q": soql})
        if response.status_code != 200:
            raise Exception(f"SOQL execution failed: {response.text}")
        return response.json()

    # --- TOOLING API QUERY ---
    def tooling_query(self, soql: str) -> Dict[str, Any]:
        """
        Executes a Tooling API query (metadata structure).
        """
        if self.is_simulated:
            return self._mock_tooling_soql(soql)
            
        url = f"{self.base_url}/tooling/query"
        response = requests.get(url, headers=self.headers, params={"q": soql})
        if response.status_code != 200:
            raise Exception(f"Tooling query failed: {response.text}")
        return response.json()

    # --- SOBJECT DESCRIBE ---
    def get_object_describe(self, object_name: str) -> Dict[str, Any]:
        """
        Returns full schema definition of a given object.
        """
        if self.is_simulated:
            sobj = MOCK_METADATA["sObjects"].get(object_name)
            if not sobj:
                raise Exception(f"Object {object_name} not found in simulator")
            return sobj
            
        url = f"{self.base_url}/sobjects/{object_name}/describe"
        response = requests.get(url, headers=self.headers)
        if response.status_code != 200:
            raise Exception(f"Describe object failed: {response.text}")
        return response.json()

    # --- ADMIN WORKFLOWS (WRITE ACTIONS) ---
    def create_user(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new Salesforce User.
        """
        if self.is_simulated:
            new_id = f"00580000000a{len(MOCK_METADATA['Users']) + 111}"
            new_user = {
                "Id": new_id,
                "Username": payload.get("Username"),
                "LastName": payload.get("LastName"),
                "Email": payload.get("Email"),
                "ProfileId": payload.get("ProfileId"),
                "ProfileName": next((p["Name"] for p in MOCK_METADATA["Profiles"] if p["Id"] == payload.get("ProfileId")), "Standard User"),
                "IsActive": True,
                "PermissionSets": []
            }
            MOCK_METADATA["Users"].append(new_user)
            return {"id": new_id, "success": True, "errors": []}

        url = f"{self.base_url}/sobjects/User"
        response = requests.post(url, headers=self.headers, json=payload)
        if response.status_code != 201:
            raise Exception(f"User creation failed: {response.text}")
        return response.json()

    def assign_permission_set(self, user_id: str, perm_set_id: str) -> Dict[str, Any]:
        """
        Assigns a permission set to a user.
        """
        if self.is_simulated:
            user = next((u for u in MOCK_METADATA["Users"] if u["Id"] == user_id), None)
            perm_set = next((p for p in MOCK_METADATA["PermissionSets"] if p["Id"] == perm_set_id), None)
            if not user or not perm_set:
                raise Exception("User or Permission Set not found in simulator")
            if perm_set["Name"] not in user["PermissionSets"]:
                user["PermissionSets"].append(perm_set["Name"])
            return {"id": f"0Pa{user_id[-5:]}", "success": True, "errors": []}

        url = f"{self.base_url}/sobjects/PermissionSetAssignment"
        payload = {
            "AssigneeId": user_id,
            "PermissionSetId": perm_set_id
        }
        response = requests.post(url, headers=self.headers, json=payload)
        if response.status_code != 201:
            raise Exception(f"Permission Set assignment failed: {response.text}")
        return response.json()

    def clone_permissions(self, source_user_id: str, target_user_id: str) -> List[Dict[str, Any]]:
        """
        Clones permission sets from one user to another.
        """
        results = []
        if self.is_simulated:
            src_user = next((u for u in MOCK_METADATA["Users"] if u["Id"] == source_user_id), None)
            tgt_user = next((u for u in MOCK_METADATA["Users"] if u["Id"] == target_user_id), None)
            if not src_user or not tgt_user:
                raise Exception("Source or Target User not found in simulator")
            
            for ps_name in src_user["PermissionSets"]:
                ps = next((p for p in MOCK_METADATA["PermissionSets"] if p["Name"] == ps_name), None)
                if ps:
                    self.assign_permission_set(target_user_id, ps["Id"])
                    results.append({"permissionSet": ps_name, "success": True})
            return results

        # 1. Fetch source user's PermissionSetAssignments
        soql = f"SELECT PermissionSetId, PermissionSet.Name FROM PermissionSetAssignment WHERE AssigneeId = '{source_user_id}' AND PermissionSet.IsOwnedByProfile = false"
        res = self.query(soql)
        
        # 2. Replicate to target
        for record in res.get("records", []):
            ps_id = record["PermissionSetId"]
            ps_name = record["PermissionSet"]["Name"]
            try:
                self.assign_permission_set(target_user_id, ps_id)
                results.append({"permissionSet": ps_name, "success": True})
            except Exception as e:
                results.append({"permissionSet": ps_name, "success": False, "error": str(e)})
                
        return results

    # --- SIMULATOR BACKEND MOCKS ---
    def _mock_soql(self, soql: str) -> Dict[str, Any]:
        """
        A basic parser to mock key SOQL queries during simulator operations.
        """
        soql_lower = soql.lower().replace("+", " ")
        
        # 1. SELECT ... FROM Organization
        if "from organization" in soql_lower:
            return {
                "totalSize": 1,
                "done": True,
                "records": [MOCK_METADATA["Organization"]]
            }
            
        # 2. SELECT ... FROM User
        if "from user" in soql_lower:
            records = []
            for u in MOCK_METADATA["Users"]:
                records.append({
                    "Id": u["Id"],
                    "Username": u["Username"],
                    "LastName": u["LastName"],
                    "Email": u["Email"],
                    "Profile": {"Name": u["ProfileName"]},
                    "IsActive": u["IsActive"]
                })
            return {
                "totalSize": len(records),
                "done": True,
                "records": records
            }
            
        # 3. SELECT ... FROM PermissionSet
        if "from permissionset" in soql_lower:
            records = []
            for p in MOCK_METADATA["PermissionSets"]:
                records.append({
                    "Id": p["Id"],
                    "Name": p["Name"],
                    "Label": p["Label"]
                })
            return {
                "totalSize": len(records),
                "done": True,
                "records": records
            }

        # 4. SELECT ... FROM Profile
        if "from profile" in soql_lower:
            records = []
            for p in MOCK_METADATA["Profiles"]:
                records.append({
                    "Id": p["Id"],
                    "Name": p["Name"]
                })
            return {
                "totalSize": len(records),
                "done": True,
                "records": records
            }

        # Fallback empty query response
        return {
            "totalSize": 0,
            "done": True,
            "records": []
        }

    def _mock_tooling_soql(self, soql: str) -> Dict[str, Any]:
        """
        A basic parser to mock key Tooling API queries.
        """
        soql_lower = soql.lower().replace("+", " ")
        
        # 1. ApexClass query
        if "from apexclass" in soql_lower:
            records = []
            for name, data in MOCK_METADATA["ApexClasses"].items():
                records.append({
                    "Id": data["Id"],
                    "Name": data["Name"],
                    "ApiVersion": data["ApiVersion"],
                    "Body": data["Body"]
                })
            return {
                "totalSize": len(records),
                "done": True,
                "records": records
            }
            
        # 2. ApexTrigger query
        if "from apextrigger" in soql_lower:
            records = []
            for name, data in MOCK_METADATA["ApexTriggers"].items():
                records.append({
                    "Id": data["Id"],
                    "Name": data["Name"],
                    "TableEnumOrId": data["TableEnumOrId"],
                    "Body": data["Body"]
                })
            return {
                "totalSize": len(records),
                "done": True,
                "records": records
            }
            
        # 3. Flow query
        if "from flow" in soql_lower:
            records = []
            for name, data in MOCK_METADATA["Flows"].items():
                records.append({
                    "Id": data["Id"],
                    "Label": data["Label"],
                    "DeveloperName": data["DeveloperName"],
                    "Status": data["Status"],
                    "Type": data["Type"]
                })
            return {
                "totalSize": len(records),
                "done": True,
                "records": records
            }

        return {
            "totalSize": 0,
            "done": True,
            "records": []
        }
