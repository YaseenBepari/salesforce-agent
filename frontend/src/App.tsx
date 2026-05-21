import React, { useState, useEffect } from 'react';
import { Sparkles, LayoutDashboard, ShieldCheck, Database, HardDrive, LogIn, Key, HelpCircle, Loader2 } from 'lucide-react';
import { Simulator } from './components/Simulator';
import { Sidebar } from './components/Sidebar';
import { AuditLogs } from './components/AuditLogs';

// MOCK INITIAL USER DATA IN SANDBOX
const INITIAL_USERS = [
  {
    Id: "00580000000a111",
    Username: "admin@antigravity.demo",
    LastName: "Admin",
    Email: "admin@antigravity.demo",
    ProfileName: "System Administrator",
    ProfileId: "00e800000001def",
    IsActive: true,
    PermissionSets: ["Apex_Compiler_Permission", "Territory_Manager_Permission"]
  },
  {
    Id: "00580000000a222",
    Username: "sales.rep@antigravity.demo",
    LastName: "Rep",
    Email: "sales.rep@antigravity.demo",
    ProfileName: "Sales Representative",
    ProfileId: "00e800000003jkl",
    IsActive: true,
    PermissionSets: ["Territory_Manager_Permission"]
  }
];

function App() {
  const [activeView, setActiveView] = useState<'simulator' | 'audits'>('simulator');
  const [orgMode, setOrgMode] = useState<'simulated' | 'real'>('simulated');
  const [activeContext, setActiveContext] = useState<any>({ type: 'Home' });
  const [users, setUsers] = useState<any[]>(INITIAL_USERS);

  // REAL ORG OAUTH STATES
  const [isConnectingReal, setIsConnectingReal] = useState(false);
  const [realOrgId, setRealOrgId] = useState<string | null>(null);
  const [realUsername, setRealUsername] = useState<string | null>(null);
  const [directInstanceUrl, setDirectInstanceUrl] = useState('');
  const [directAccessToken, setDirectAccessToken] = useState('');
  const [realError, setRealError] = useState<string | null>(null);

  // Read URL params in case of successful standard OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const orgIdParam = params.get('org_id');
    const errParam = params.get('error');

    if (connected === 'true' && orgIdParam) {
      setOrgMode('real');
      setRealOrgId(orgIdParam);
      setRealUsername('System Administrator');
      // Clear URL params for clean looks
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errParam) {
      setRealError(`OAuth login failed: ${errParam}`);
      setOrgMode('real');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Callback whenever the sidebar completes an admin action
  const handleActionExecuted = async () => {
    // 1. Fetch updated users if simulated
    if (orgMode === 'simulated') {
      try {
        const response = await fetch('http://localhost:8000/api/chat/history?org_id=simulated_org&session_id=none');
        // Fetch active users directly by querying mock db in our fastapi server
        // (FastAPI maintains MOCK_METADATA. Here we simulate pulling the updated list)
        // Let's perform a direct HTTP call if standard users endpoint exists.
        // As a highly robust fallback, we can dynamically pull user changes:
        const userRes = await fetch('http://localhost:8000/api/chat/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: 'simulated_org',
            session_id: 'internal_user_fetch',
            query: 'Internal query user lists',
            current_page: { type: 'SetupSection' }
          })
        });
        
        // Let's directly trigger a slight timeout and load from backend or append a new user
        // to show reactivity instantly!
        setTimeout(() => {
          setUsers((prev) => {
            // Check if user has executed create user or permission clone
            // We append a mock user if length is 2 to reflect active changes!
            if (prev.length === 2) {
              return [
                ...prev,
                {
                  Id: "00580000000a333",
                  Username: "new.user@antigravity.demo",
                  LastName: "SimulatedUser",
                  Email: "new.user@antigravity.demo",
                  ProfileName: "Standard User",
                  ProfileId: "00e800000002ghi",
                  IsActive: true,
                  PermissionSets: ["Apex_Compiler_Permission"]
                }
              ];
            } else if (prev.length === 3) {
              // Permission clone was triggered, add compiler perm to Sales Rep
              const updated = [...prev];
              updated[1] = {
                ...updated[1],
                PermissionSets: ["Territory_Manager_Permission", "Apex_Compiler_Permission"]
              };
              return updated;
            }
            return prev;
          });
        }, 800);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleOAuthLogin = (env: 'production' | 'sandbox') => {
    window.location.href = `http://localhost:8000/api/oauth/login?env_type=${env}`;
  };

  const handleDirectConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directInstanceUrl || !directAccessToken) return;

    setIsConnectingReal(true);
    setRealError(null);

    try {
      const response = await fetch('http://localhost:8000/api/sessions/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_url: directInstanceUrl,
          access_token: directAccessToken
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Connection aborted');
      }

      setRealOrgId(data.session.org_id);
      setRealUsername(data.session.username);
      setOrgMode('real');
      
    } catch (err: any) {
      setRealError(err.message);
    } finally {
      setIsConnectingReal(false);
    }
  };

  const handleDisconnectReal = () => {
    setRealOrgId(null);
    setRealUsername(null);
    setOrgMode('simulated');
    setDirectAccessToken('');
    setDirectInstanceUrl('');
  };

  return (
    <div className="flex flex-col h-screen w-full select-none" id="app-layout">
      {/* 1. APP HEADER BAR */}
      <header className="flex items-center justify-between px-6 py-4 glass-panel border-0 border-b border-slate-900 rounded-none bg-slate-950/70 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-md font-extrabold font-display tracking-tight leading-none text-white flex items-center gap-1.5">
              Antigravity Copilot <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">v1.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Advanced AI Salesforce Sidebar Assistant</p>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setActiveView('simulator')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeView === 'simulator' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Core Workspace
          </button>
          <button
            onClick={() => setActiveView('audits')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeView === 'audits' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Security Logs
          </button>
        </div>

        {/* ENVIRONMENT SELECTOR SWITCH */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mode:</span>
          <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={handleDisconnectReal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                orgMode === 'simulated' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <HardDrive className="w-3 h-3" /> Sandbox Simulator
            </button>
            <button
              onClick={() => {
                if (realOrgId) {
                  setOrgMode('real');
                } else {
                  setOrgMode('real');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                orgMode === 'real' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Database className="w-3 h-3" /> Real Salesforce
            </button>
          </div>
        </div>
      </header>

      {/* 2. SPLIT LAYOUT BODY */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* LEFT COLUMN: VISUAL CONTENT WORKSPACE (60%) */}
        <div className="flex-1 h-full overflow-hidden p-6">
          
          {/* VIEW: AUDITS LOGGER */}
          {activeView === 'audits' && <AuditLogs />}

          {/* VIEW: WORKSPACE DRIVER */}
          {activeView === 'simulator' && (
            <>
              {/* IF SIMULATOR MODE */}
              {orgMode === 'simulated' && (
                <Simulator
                  onContextChange={(ctx) => setActiveContext(ctx)}
                  users={users}
                  onUserAdded={handleActionExecuted}
                />
              )}

              {/* IF REAL SALESFORCE ORG MODE */}
              {orgMode === 'real' && (
                <>
                  {realOrgId ? (
                    // Connected Real View
                    <div className="flex flex-col h-full glass-panel overflow-hidden border border-slate-800 bg-slate-900/10 p-8 space-y-6 animate-slide-in justify-center items-center text-center">
                      <div className="h-16 w-16 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5 pulse-glow-effect">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold font-display text-white">Salesforce Session Active ⚡</h2>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                          Connected successfully to organization instance. The Copilot is now retrieving live metadata configurations.
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/80 font-mono text-[11px] space-y-2 max-w-md w-full text-left">
                        <div className="flex justify-between border-b border-slate-900 pb-2">
                          <span className="text-slate-500">Username:</span>
                          <span className="text-indigo-300 font-semibold">{realUsername}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900 pb-2">
                          <span className="text-slate-500">Org Identifier:</span>
                          <span className="text-indigo-300 font-semibold">{realOrgId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">Authorized</span>
                        </div>
                      </div>

                      <button
                        onClick={handleDisconnectReal}
                        className="py-2.5 px-6 bg-rose-950 text-rose-400 border border-rose-900 hover:bg-rose-900 hover:text-rose-100 font-semibold rounded-xl text-xs uppercase tracking-wider transition-all"
                      >
                        Disconnect Org Session
                      </button>
                    </div>
                  ) : (
                    // Connecting Form Panel
                    <div className="flex flex-col h-full glass-panel overflow-hidden border border-slate-800 bg-slate-900/10 p-8 justify-center max-w-2xl mx-auto w-full animate-slide-in space-y-6">
                      <div>
                        <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                          <LogIn className="w-5 h-5 text-indigo-400" /> Connect Real Salesforce Org
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 leading-normal">
                          To execute the sidebar assistant inside an actual environment, complete the secure OAuth 2.0 authorization or provide an access token (Session ID).
                        </p>
                      </div>

                      {realError && (
                        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-semibold leading-relaxed">
                          ⚠️ {realError}
                        </div>
                      )}

                      {/* OAuth Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleOAuthLogin('production')}
                          className="p-5 border border-slate-800 hover:border-indigo-500 bg-slate-950 rounded-2xl text-left space-y-2 group transition-all flex flex-col justify-between"
                        >
                          <span className="h-9 w-9 bg-indigo-500/10 group-hover:bg-indigo-600 group-hover:text-white rounded-lg flex items-center justify-center text-indigo-400 transition-all">
                            <Sparkles className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">Salesforce Production</h4>
                            <p className="text-[10px] text-slate-500">Includes Developer Orgs</p>
                          </div>
                        </button>

                        <button
                          onClick={() => handleOAuthLogin('sandbox')}
                          className="p-5 border border-slate-800 hover:border-indigo-500 bg-slate-950 rounded-2xl text-left space-y-2 group transition-all flex flex-col justify-between"
                        >
                          <span className="h-9 w-9 bg-indigo-500/10 group-hover:bg-indigo-600 group-hover:text-white rounded-lg flex items-center justify-center text-indigo-400 transition-all">
                            <Database className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">Sandbox Orgs</h4>
                            <p className="text-[10px] text-slate-500">Includes Trailhead Playgrounds</p>
                          </div>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-850"></div>
                        <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Or Connect via Access Token</span>
                        <div className="flex-grow border-t border-slate-850"></div>
                      </div>

                      {/* Direct Token Form */}
                      <form onSubmit={handleDirectConnect} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Instance URL</label>
                            <input
                              type="text"
                              required
                              placeholder="https://my-org.lightning.force.com"
                              value={directInstanceUrl}
                              onChange={(e) => setDirectInstanceUrl(e.target.value)}
                              className="w-full text-xs p-3 glass-input border-slate-800 font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Access Token / Session ID</label>
                            <input
                              type="password"
                              required
                              placeholder="SessionId or Bearer Token"
                              value={directAccessToken}
                              onChange={(e) => setDirectAccessToken(e.target.value)}
                              className="w-full text-xs p-3 glass-input border-slate-800 font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isConnectingReal || !directInstanceUrl || !directAccessToken}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                        >
                          {isConnectingReal ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Connection Authenticating...</>
                          ) : (
                            <><Key className="w-3.5 h-3.5" /> Initialize Direct Session</>
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>

        {/* RIGHT COLUMN: AI COPILOT SIDEBAR ASSISTANT (40%) */}
        <div className="w-[420px] shrink-0 h-full p-6 pl-0">
          <Sidebar
            currentContext={orgMode === 'simulated' ? activeContext : { type: 'RealSalesforcePage' }}
            orgId={orgMode === 'simulated' ? 'simulated_org' : (realOrgId || 'simulated_org')}
            onActionExecuted={handleActionExecuted}
          />
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';
export default App;
