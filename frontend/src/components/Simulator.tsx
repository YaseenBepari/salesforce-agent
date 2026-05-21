import React, { useState } from 'react';
import { Database, Code, GitFork, Users, FileText, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface SimulatorProps {
  onContextChange: (newContext: any) => void;
  users: any[];
  onUserAdded: () => void;
}

export const Simulator: React.FC<SimulatorProps> = ({ onContextChange, users, onUserAdded }) => {
  const [activeTab, setActiveTab] = useState<'account' | 'apex' | 'flow' | 'admin'>('account');
  const [vipStatus, setVipStatus] = useState<boolean>(true);
  const [revenue, setRevenue] = useState<string>('750000');
  const [validationAlert, setValidationAlert] = useState<string | null>(
    'A VIP Account must have an Annual Revenue of at least $1,000,000.'
  );

  // MOCK CODE FOR APEX VIEW
  const [apexClassBody, setApexClassBody] = useState<string>(`/**
 * @description Handles automated opportunity discounting
 * WARNING: Watch out for recursive trigger flags on bulk update!
 */
public with sharing class DiscountHandler {
    
    private static Boolean hasRun = false;
    
    public static void applyVIPDiscounts(List<Opportunity> newOpps) {
        if (hasRun) return;
        hasRun = true;
        
        Set<Id> accIds = new Set<Id>();
        for (Opportunity opp : newOpps) {
            if (opp.AccountId != null) accIds.add(opp.AccountId);
        }
        
        Map<Id, Account> vipAccounts = new Map<Id, Account>([
            SELECT Id, VIP_Status__c FROM Account 
            WHERE Id IN :accIds AND VIP_Status__c = true
        ]);
        
        for (Opportunity opp : newOpps) {
            if (opp.AccountId != null && vipAccounts.containsKey(opp.AccountId)) {
                if (opp.Amount > 10000) {
                    opp.Amount = opp.Amount * 0.85;
                    opp.Discount_Approved__c = true;
                }
            }
        }
    }
}`);

  // Emits active page context whenever the tab or important properties change
  React.useEffect(() => {
    let context: any = { type: 'Home' };

    if (activeTab === 'account') {
      context = {
        type: 'RecordDetail',
        objectName: 'Account',
        recordId: '00180000000abcd',
        fields: {
          Name: 'Acme Corp',
          AnnualRevenue: parseFloat(revenue) || 0,
          VIP_Status__c: vipStatus,
          Industry: 'Technology',
          Rating: 'Hot',
        },
        validationRules: [
          {
            name: 'Require_VIP_Revenue',
            formula: 'AND( VIP_Status__c = True, AnnualRevenue < 1000000 )',
            message: 'A VIP Account must have an Annual Revenue of at least $1,000,000.',
            isActive: true,
          },
        ],
      };
    } else if (activeTab === 'apex') {
      context = {
        type: 'ApexClass',
        name: 'DiscountHandler',
        recordId: '01q800000001abc',
        body: apexClassBody,
      };
    } else if (activeTab === 'flow') {
      context = {
        type: 'Flow',
        name: 'Opportunity_Auto_Discount_Flow',
        developerName: 'Opportunity_Auto_Discount_Flow',
        nodes: [
          { id: 'Start', type: 'Trigger', label: 'Trigger: Opportunity Created/Updated' },
          { id: 'VIP_Check', type: 'Decision', label: 'VIP Status == True?' },
          { id: 'Approve_Disc', type: 'Action', label: 'Set Discount Approved = True' },
        ],
      };
    } else if (activeTab === 'admin') {
      context = {
        type: 'SetupSection',
        name: 'UserManagement',
        usersCount: users.length,
      };
    }

    onContextChange(context);
  }, [activeTab, vipStatus, revenue, apexClassBody, users.length]);

  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRevenue(val);
    const num = parseFloat(val) || 0;
    if (vipStatus && num < 1000000) {
      setValidationAlert('Validation Error: A VIP Account must have an Annual Revenue of at least $1,000,000 (Account.Require_VIP_Revenue).');
    } else {
      setValidationAlert(null);
    }
  };

  const toggleVip = () => {
    const nextVip = !vipStatus;
    setVipStatus(nextVip);
    const num = parseFloat(revenue) || 0;
    if (nextVip && num < 1000000) {
      setValidationAlert('Validation Error: A VIP Account must have an Annual Revenue of at least $1,000,000 (Account.Require_VIP_Revenue).');
    } else {
      setValidationAlert(null);
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel overflow-hidden border border-slate-800" id="salesforce-simulator">
      {/* SIMULATOR HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-md font-bold font-display tracking-tight flex items-center gap-1.5">
              Salesforce Sandbox <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">CS42</span>
            </h2>
            <p className="text-[11px] text-slate-400">Context Simulation Engine</p>
          </div>
        </div>
        
        {/* TAB CONTROLS */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'account' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-account"
          >
            <FileText className="w-3.5 h-3.5" /> sObject Layout
          </button>
          <button
            onClick={() => setActiveTab('apex')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'apex' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-apex"
          >
            <Code className="w-3.5 h-3.5" /> Apex Editor
          </button>
          <button
            onClick={() => setActiveTab('flow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'flow' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-flow"
          >
            <GitFork className="w-3.5 h-3.5" /> Flow Automation
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
            id="tab-admin"
          >
            <Users className="w-3.5 h-3.5" /> Setup Org
          </button>
        </div>
      </div>

      {/* SCREEN CONTAINER */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
        
        {/* 1. TAB: ACCOUNT DETAIL */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-slide-in">
            {/* Context Notice */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 glass-card-dark">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <div className="text-xs">
                <span className="font-semibold text-slate-200">Active View: </span> 
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Account</span> Detail Page (Record ID: <span className="font-mono text-slate-300">00180000000abcd</span>)
              </div>
            </div>

            {/* Validation Rule Alert */}
            {validationAlert && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 animate-pulse-glow-effect">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold font-display">Active Validation Triggered!</h4>
                  <p className="text-[11px] text-amber-200/90 mt-1">{validationAlert}</p>
                </div>
              </div>
            )}

            {/* Record Card */}
            <div className="glass-panel p-6 border-slate-800 bg-slate-900/10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold font-display text-white">Acme Corporation</h3>
                  <p className="text-[11px] text-slate-400">sObject Type: Account</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">Record Type: Standard</span>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Account Name</label>
                  <input
                    type="text"
                    value="Acme Corporation"
                    disabled
                    className="w-full text-sm p-3 glass-input bg-slate-900/60 opacity-60 cursor-not-allowed border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Industry</label>
                  <select disabled className="w-full text-sm p-3 glass-input bg-slate-900/60 opacity-60 cursor-not-allowed border-slate-800">
                    <option>Technology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Annual Revenue ($)</label>
                  <input
                    type="number"
                    value={revenue}
                    onChange={handleRevenueChange}
                    className="w-full text-sm p-3 glass-input bg-slate-900/40 border-slate-700 focus:border-indigo-500 font-mono"
                    placeholder="Enter Annual Revenue"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">VIP Customer Status</label>
                  <button
                    onClick={toggleVip}
                    className={`w-full text-xs font-semibold p-3 rounded-xl border flex items-center justify-between transition-all ${
                      vipStatus
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-indigo-500/5 shadow-inner'
                        : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{vipStatus ? 'VIP Custom Flag Enabled' : 'Standard Status'}</span>
                    <span className={`w-3.5 h-3.5 rounded-full ${vipStatus ? 'bg-indigo-400 shadow-lg shadow-indigo-400/50' : 'bg-slate-600'} transition-all`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Validation rules panel */}
            <div className="glass-panel p-5 border-slate-850 bg-slate-900/20 space-y-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> Object Validation Rules (1)
              </h4>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold font-mono text-indigo-300">Account.Require_VIP_Revenue</span>
                  <span className="slds-badge slds-badge-success">Active</span>
                </div>
                <div className="font-mono text-[10px] text-indigo-200/60 p-2.5 bg-slate-950 border border-slate-900 rounded-lg">
                  {`AND( VIP_Status__c = True, AnnualRevenue < 1000000 )`}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  <span className="font-semibold text-slate-300">Validation Prompt:</span> A VIP Account must have an Annual Revenue of at least $1,000,000.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. TAB: APEX EDITOR */}
        {activeTab === 'apex' && (
          <div className="space-y-6 animate-slide-in">
            {/* Context Notice */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 glass-card-dark">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="text-xs">
                <span className="font-semibold text-slate-200">Active View: </span>
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">ApexClass</span> compiler environment
              </div>
            </div>

            {/* Apex Class Editor */}
            <div className="glass-panel overflow-hidden border-slate-800 bg-slate-950">
              {/* File bar */}
              <div className="flex items-center justify-between bg-slate-900/60 px-4 py-2 border-b border-slate-850">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-semibold text-slate-300 font-mono">DiscountHandler.cls</span>
                </div>
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">v59.0 API</span>
              </div>
              
              <div className="p-4 overflow-x-auto">
                <textarea
                  value={apexClassBody}
                  onChange={(e) => setApexClassBody(e.target.value)}
                  rows={20}
                  className="w-full text-[11px] font-mono p-3 bg-slate-950 border-0 focus:outline-none focus:ring-0 text-indigo-100 font-medium resize-y leading-relaxed"
                  style={{ whiteSpace: 'pre', tabSize: 4 }}
                />
              </div>
            </div>

            {/* Trigger Reference block */}
            <div className="glass-panel p-5 border-slate-850 bg-slate-900/20 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-400" /> Connected Object Trigger (1)
              </h4>
              <div className="rounded-xl border border-slate-850 bg-slate-950 overflow-hidden text-xs">
                <div className="bg-slate-900/40 border-b border-slate-850 px-4 py-2 flex justify-between font-mono text-[10px] text-slate-400">
                  <span>OpportunityTrigger.trigger</span>
                  <span>before insert, before update</span>
                </div>
                <pre className="p-4 text-[10px] text-emerald-300/80 font-mono leading-relaxed overflow-x-auto">
{`trigger OpportunityTrigger on Opportunity (before insert, before update) {
    if (Trigger.isBefore) {
        if (Trigger.isInsert || Trigger.isUpdate) {
            // Apply corporate VIP discount rates
            DiscountHandler.applyVIPDiscounts(Trigger.new);
        }
    }
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 3. TAB: FLOW VISUALIZER */}
        {activeTab === 'flow' && (
          <div className="space-y-6 animate-slide-in">
            {/* Context Notice */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 glass-card-dark">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
              </span>
              <div className="text-xs">
                <span className="font-semibold text-slate-200">Active View: </span>
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">FlowDesigner</span> canvas UI
              </div>
            </div>

            {/* FLOW CANVAS GRAPHICS */}
            <div className="glass-panel p-6 border-slate-800 bg-slate-900/10 min-h-[380px] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-display mb-1">Opportunity VIP Discount Automation</h3>
                <p className="text-[10px] text-slate-400 font-mono">DeveloperName: Opportunity_Auto_Discount_Flow | Active (Trigger: Before-Save)</p>
              </div>

              {/* Graphical nodes alignment */}
              <div className="flex flex-col items-center justify-center py-6 space-y-6 relative">
                
                {/* Node 1 */}
                <div className="flex flex-col items-center z-10">
                  <div className="px-5 py-3 rounded-xl border border-indigo-500 bg-indigo-500/15 text-xs font-semibold shadow-indigo-500/20 shadow-lg text-center min-w-[180px]">
                    <span className="text-[9px] uppercase tracking-wider text-indigo-400 block mb-0.5">Start / Trigger</span>
                    Record Created or Updated
                  </div>
                  <div className="h-6 w-0.5 bg-slate-700 mt-0.5" />
                </div>

                {/* Node 2 */}
                <div className="flex flex-col items-center z-10">
                  <div className="px-6 py-4 rounded-xl border border-amber-500 bg-slate-900 text-xs font-semibold shadow-lg text-center min-w-[180px] relative">
                    <span className="text-[9px] uppercase tracking-wider text-amber-500 block mb-1 font-bold">Decision Node</span>
                    Is Account VIP?
                    {/* Lateral split lines */}
                    <div className="absolute right-0 top-1/2 w-8 h-0.5 bg-slate-700" />
                    <div className="absolute left-0 top-1/2 w-8 h-0.5 bg-slate-700" />
                  </div>
                </div>

                {/* Decision Branch alignment */}
                <div className="grid grid-cols-2 gap-16 w-full max-w-sm mt-3 relative">
                  {/* Left Side: YES */}
                  <div className="flex flex-col items-center z-10">
                    <div className="text-[10px] text-emerald-400 font-bold mb-3 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Yes VIP</div>
                    <div className="px-4 py-3 rounded-xl border border-emerald-500 bg-emerald-500/15 text-xs font-medium text-center shadow-lg">
                      <span className="text-[9px] uppercase text-emerald-300 block mb-0.5">Update Fields</span>
                      Discount Approved = <span className="font-mono font-bold text-emerald-400">TRUE</span>
                    </div>
                  </div>

                  {/* Right Side: NO */}
                  <div className="flex flex-col items-center z-10">
                    <div className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-slate-700">No Action</div>
                    <div className="px-4 py-3 rounded-xl border border-slate-750 bg-slate-900/60 text-xs font-medium text-slate-400 text-center">
                      <span className="text-[9px] uppercase block mb-0.5">Stop Phase</span>
                      Continue Save Process
                    </div>
                  </div>
                </div>

                {/* Flow lines background */}
                <div className="absolute top-[80px] bottom-[30px] w-0.5 bg-slate-700 left-1/2 -translate-x-1/2 z-0" />
              </div>

              <div className="flex items-center gap-2 text-[10px] text-indigo-400 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/15">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Notice: Before-save flows run 10x faster than standard Apex triggers and do not consume SOQL execution limits.</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. TAB: ADMIN CONSOLE */}
        {activeTab === 'admin' && (
          <div className="space-y-6 animate-slide-in">
            {/* Context Notice */}
            <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 glass-card-dark">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <div className="text-xs">
                <span className="font-semibold text-slate-200">Active View: </span>
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">Setup</span> User & Profiles dashboard
              </div>
            </div>

            {/* Users listing Table */}
            <div className="glass-panel overflow-hidden border-slate-800 bg-slate-900/10">
              <div className="bg-slate-900/60 px-5 py-4 border-b border-slate-850 flex justify-between items-center">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Sandbox Users</h4>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-500/20">{users.length} Users Found</span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 bg-slate-950/40 text-slate-400 font-semibold">
                      <th className="p-4">Username</th>
                      <th className="p-4">Role / Profile</th>
                      <th className="p-4">Active</th>
                      <th className="p-4">Assigned Permission Sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={i} className="border-b border-slate-850/60 hover:bg-slate-900/25">
                        <td className="p-4">
                          <div className="font-semibold text-white">{u.Username}</div>
                          <div className="text-[10px] text-slate-400">{u.Email}</div>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-indigo-300">
                          {u.ProfileName}
                        </td>
                        <td className="p-4">
                          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Active
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {u.PermissionSets && u.PermissionSets.length > 0 ? (
                              u.PermissionSets.map((ps: string, pIdx: number) => (
                                <span key={pIdx} className="text-[9px] font-mono bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 rounded-md text-indigo-300 font-medium">
                                  {ps}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">No assigned sets</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="glass-panel p-5 border-slate-850 bg-slate-900/20 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Direct Actions
              </h4>
              <p className="text-[11px] text-slate-400">
                You can trigger automated user provisioning flows directly inside the sidebar assistant. Type **"Create a user"** or **"Clone permissions"** in the chat, and the Copilot will propose the structured action for you to approve!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
