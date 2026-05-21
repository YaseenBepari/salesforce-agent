import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Key, CheckCircle, XCircle, ChevronDown, ChevronRight, Loader2, ArrowRight, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SidebarProps {
  currentContext: any;
  orgId: string;
  onActionExecuted: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: any; // Proposed action payload
  isStreaming?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentContext, orgId, onActionExecuted }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '### Welcome to Antigravity Salesforce Copilot ⚡\n\nI am your real-time assistant, connected directly to this Salesforce Org session.\n\nI can help you:\n1. **Analyze Apex Triggers** for bulkification or recursion bugs.\n2. **Troubleshoot validation errors** in validation formulas.\n3. **Explain before-save Flows** and check order of execution conflicts.\n4. **Generate secure SOQL queries** and automatically execute admin updates.\n\n*Select a tab in the Sandbox Simulator to sync my context, and try asking one of the recommended queries below!*',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyType, setApiKeyType] = useState<'openai' | 'anthropic'>('openai');
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [sessionId] = useState<string>(() => `session_${Math.random().toString(36).substring(2, 9)}`);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suggested questions mapped to current context
  const getSuggestedPrompts = () => {
    if (!currentContext) return [];
    
    if (currentContext.type === 'RecordDetail') {
      return [
        { label: 'Explain VIP validation rule', query: 'Explain the active Require_VIP_Revenue validation rule on this Account' },
        { label: 'Run SOQL on VIP accounts', query: 'Run a SOQL query to fetch the active VIP Accounts in the org' },
      ];
    } else if (currentContext.type === 'ApexClass' || currentContext.type === 'ApexTrigger') {
      return [
        { label: 'Check for recursion bugs ⚠️', query: 'Explain the static Boolean recursion bug in this DiscountHandler class' },
        { label: 'Draft bulk-safe handler', query: 'Draft a fully bulk-safe trigger handler version of DiscountHandler' },
      ];
    } else if (currentContext.type === 'Flow') {
      return [
        { label: 'Analyze Flow logic', query: 'Analyze the logic of the Opportunity VIP Discount record-triggered Flow' },
        { label: 'Order of execution conflicts', query: 'Are there any order of execution conflicts between this Flow and the Apex Trigger?' },
      ];
    } else if (currentContext.type === 'SetupSection') {
      return [
        { label: 'Create a new User', query: 'Create a new simulated Salesforce standard user named new.user@antigravity.demo' },
        { label: 'Clone permissions to Sales Rep', query: 'Clone assigned permissions from Admin to Sales Rep' },
      ];
    }
    
    return [
      { label: 'Summarize org configuration', query: 'Summarize the current Salesforce org setup' },
      { label: 'Generate standard SOQL', query: 'Generate a standard SOQL query to select Opportunities over $100k' },
    ];
  };

  const handleSend = async (queryText: string) => {
    if (!queryText.trim() || isSending) return;

    // Clear input
    setInputValue('');
    setIsSending(true);

    // 1. Add User message
    const userMsg: Message = { role: 'user', content: queryText };
    setMessages((prev) => [...prev, userMsg]);

    // 2. Add empty assistant message for streaming
    const assistantMsg: Message = { role: 'assistant', content: '', isStreaming: true };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      // 3. Initiate post request with context and key headers
      const headers: Dict<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // If user supplied API key in sidebar, inject it in standard environment variables via standard header if needed
      // (Backend will read standard env variables, but we can configure it)
      const response = await fetch('http://localhost:8000/api/chat/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          org_id: orgId,
          session_id: sessionId,
          query: queryText,
          current_page: currentContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to query backend: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let actionObject: any = null;

      if (!reader) throw new Error('No stream reader available');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // SSE responses can contain multiple chunks separated by double newlines
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            try {
              const dataObj = jsonParse(dataStr);
              
              if (dataObj.status === 'processing') {
                continue;
              }
              
              if (dataObj.action === 'APPROVAL_REQUIRED') {
                actionObject = dataObj;
              } else if (dataObj.content) {
                assistantContent += dataObj.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch (err) {
              // Ignore partial parsing issues
            }
          }
        }
      }

      // Finish streaming and append action if exists
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: assistantContent,
          isStreaming: false,
          action: actionObject,
        };
        return updated;
      });

    } catch (error: any) {
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: `❌ **Error establishing connection with AI server:** ${error.message}\n\nPlease check that your FastAPI backend is running on port 8000.`,
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsSending(false);
    }
  };

  const jsonParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  };

  // Safe action approval triggers
  const [actionStatuses, setActionStatuses] = useState<Dict<string, 'pending' | 'loading' | 'success' | 'failed' | 'rejected'>>({});
  const [actionDetails, setActionDetails] = useState<Dict<string, string>>({});
  const [expandedPayload, setExpandedPayload] = useState<Dict<string, boolean>>({});

  const handleActionApprove = async (action: any, msgIdx: number) => {
    const actionKey = `${msgIdx}_${action.log_id}`;
    setActionStatuses((prev) => ({ ...prev, [actionKey]: 'loading' }));

    try {
      const response = await fetch('http://localhost:8000/api/actions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: action.log_id,
          org_id: orgId,
          action_type: action.action_type,
          payload: action.payload,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Execution failed');
      }

      setActionStatuses((prev) => ({ ...prev, [actionKey]: 'success' }));
      setActionDetails((prev) => ({ ...prev, [actionKey]: data.message }));
      
      // Fire confetti burst!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.8 },
      });

      // Notify parent to refresh user lists etc
      onActionExecuted();

    } catch (err: any) {
      console.error(err);
      setActionStatuses((prev) => ({ ...prev, [actionKey]: 'failed' }));
      setActionDetails((prev) => ({ ...prev, [actionKey]: `Error: ${err.message}` }));
    }
  };

  const handleActionReject = async (action: any, msgIdx: number) => {
    const actionKey = `${msgIdx}_${action.log_id}`;
    setActionStatuses((prev) => ({ ...prev, [actionKey]: 'loading' }));

    try {
      await fetch('http://localhost:8000/api/actions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: action.log_id,
          reason: 'Declined by Administrator in Copilot Sidebar',
        }),
      });

      setActionStatuses((prev) => ({ ...prev, [actionKey]: 'rejected' }));
      setActionDetails((prev) => ({ ...prev, [actionKey]: 'Action declined by administrator.' }));

    } catch (err: any) {
      setActionStatuses((prev) => ({ ...prev, [actionKey]: 'failed' }));
    }
  };

  // Basic Markdown custom formatter
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      // 1. Headers
      if (line.startsWith('### ')) {
        return <h3 key={lineIdx} className="text-sm font-bold font-display text-white mt-4 mb-2">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={lineIdx} className="text-xs font-bold font-display text-indigo-300 mt-3 mb-1">{line.replace('#### ', '')}</h4>;
      }
      
      // 2. Bold triggers
      let formattedLine: React.ReactNode = line;
      if (line.includes('**')) {
        const parts = line.split('**');
        formattedLine = parts.map((part, partIdx) => 
          partIdx % 2 === 1 ? <strong key={partIdx} className="font-semibold text-white">{part}</strong> : part
        );
      }

      // 3. Inline code
      if (line.includes('`') && !line.startsWith('```')) {
        const parts = line.split('`');
        formattedLine = parts.map((part, partIdx) => 
          partIdx % 2 === 1 ? <code key={partIdx} className="font-mono text-[10px] bg-slate-950 border border-slate-900 px-1 py-0.5 rounded text-indigo-300 font-semibold">{part}</code> : part
        );
      }

      // 4. Code Blocks
      if (line.startsWith('```')) {
        return null; // Handle code blocks with better containers if needed, here we keep it basic
      }

      // 5. Bullet lists
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return (
          <li key={lineIdx} className="text-xs text-slate-300 list-disc ml-5 mb-1.5 leading-relaxed">
            {line.substring(2)}
          </li>
        );
      }

      // Standard text line
      return (
        <p key={lineIdx} className="text-xs text-slate-300 leading-relaxed mb-2">
          {formattedLine}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full glass-panel border border-slate-800" id="copilot-sidebar">
      {/* SIDEBAR HEADER */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg pulse-glow-effect">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-white flex items-center gap-1.5">
              Antigravity Copilot
            </h3>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <p className="text-[10px] text-slate-400 font-mono">
                {orgId === 'simulated_org' ? 'Sandbox Simulator Context' : 'Connected to Real Org'}
              </p>
            </div>
          </div>
        </div>
        
        {/* API Key Config Button */}
        <button
          onClick={() => setShowKeyConfig(!showKeyConfig)}
          className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
            showKeyConfig ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
          }`}
          title="Configure API Keys"
        >
          <Key className="w-3.5 h-3.5" /> Key Config
        </button>
      </div>

      {/* API KEYS DROPDOWN CONFIG */}
      {showKeyConfig && (
        <div className="p-4 border-b border-slate-850 bg-slate-950/80 space-y-3 animate-slide-in">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider">LLM Model Routing</span>
            <span className="text-[10px] text-slate-500 italic">Optional (Defaults to simulation fallback)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setApiKeyType('openai')}
              className={`py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                apiKeyType === 'openai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OpenAI
            </button>
            <button
              onClick={() => setApiKeyType('anthropic')}
              className={`py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                apiKeyType === 'anthropic' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Anthropic
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">API Secret Key</label>
            <input
              type="password"
              placeholder={`Enter your ${apiKeyType === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full text-xs p-2.5 glass-input border-slate-800"
            />
          </div>
          
          <button
            onClick={() => setShowKeyConfig(false)}
            className="w-full py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/10 hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5"
          >
            Save configurations <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CHAT CONVERSATION PANELS */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-950/45 no-scrollbar">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
          >
            {/* Context Header for Assistant response */}
            {msg.role === 'assistant' && idx > 0 && currentContext && (
              <div className="text-[10px] text-slate-400/90 font-mono bg-slate-900 border border-slate-850 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 pulse-glow-effect"></span>
                <span>Context: {currentContext.type === 'RecordDetail' ? `sObject - ${currentContext.objectName}` : currentContext.type}</span>
              </div>
            )}

            <div
              className={`max-w-[90%] p-4 rounded-2xl text-xs leading-relaxed shadow-md ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-slate-900/60 text-slate-200 border border-slate-850 rounded-bl-none glass-card-dark'
              }`}
            >
              <div className={msg.isStreaming ? 'streaming-cursor' : ''}>
                {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
              </div>
            </div>

            {/* ACTION CARD COMPONENT IF PROPOSED */}
            {msg.role === 'assistant' && msg.action && (
              <div className="w-full max-w-[90%] glass-panel border-amber-500/20 bg-amber-500/5 p-4 space-y-4 rounded-xl animate-pulse-glow-effect">
                <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="text-[11px] font-bold text-white uppercase tracking-wider font-display">Action Proposed</h4>
                      <p className="text-[9px] text-amber-300 font-semibold">{msg.action.action_type}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full text-amber-200 uppercase tracking-wider">Approval Required</span>
                </div>

                <p className="text-[11px] text-slate-300">{msg.action.description}</p>

                {/* Toggle details payload */}
                <div className="space-y-1.5">
                  <button
                    onClick={() => {
                      const k = `${idx}_${msg.action.log_id}`;
                      setExpandedPayload((prev) => ({ ...prev, [k]: !prev[k] }));
                    }}
                    className="flex items-center gap-1 text-[9px] text-indigo-400 font-semibold hover:text-indigo-300 uppercase tracking-wider"
                  >
                    {expandedPayload[`${idx}_${msg.action.log_id}`] ? (
                      <><ChevronDown className="w-3 h-3" /> Hide Action Payload</>
                    ) : (
                      <><ChevronRight className="w-3 h-3" /> View Action Payload</>
                    )}
                  </button>
                  
                  {expandedPayload[`${idx}_${msg.action.log_id}`] && (
                    <pre className="p-3 bg-slate-950/80 border border-slate-900 rounded-lg text-[9px] font-mono text-indigo-200 overflow-x-auto leading-relaxed max-h-[140px]">
                      {JSON.stringify(msg.action.payload, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Status and Action Buttons */}
                <div className="border-t border-amber-500/10 pt-3">
                  {(!actionStatuses[`${idx}_${msg.action.log_id}`] || actionStatuses[`${idx}_${msg.action.log_id}`] === 'pending') ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleActionApprove(msg.action, idx)}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg hover:bg-emerald-500 transition-all flex items-center justify-center gap-1"
                      >
                        Approve Action
                      </button>
                      <button
                        onClick={() => handleActionReject(msg.action, idx)}
                        className="py-2 px-3 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-700 hover:text-slate-200 transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  ) : actionStatuses[`${idx}_${msg.action.log_id}`] === 'loading' ? (
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Contacting sandbox gateway...</span>
                    </div>
                  ) : actionStatuses[`${idx}_${msg.action.log_id}`] === 'success' ? (
                    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[10px] space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                        <CheckCircle className="w-3.5 h-3.5" /> Transaction Successful
                      </div>
                      <p className="text-emerald-100">{actionDetails[`${idx}_${msg.action.log_id}`]}</p>
                    </div>
                  ) : actionStatuses[`${idx}_${msg.action.log_id}`] === 'rejected' ? (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider py-1">
                      <XCircle className="w-4 h-4 text-slate-500" /> Action Declined
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 text-[10px] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                        <XCircle className="w-3.5 h-3.5" /> Execution Failed
                      </div>
                      <p>{actionDetails[`${idx}_${msg.action.log_id}`]}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* SUGGESTED ACTIONS LIST */}
      <div className="px-5 py-3 border-t border-slate-900 bg-slate-950/20 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-indigo-400" /> Suggested Prompts
        </div>
        <div className="flex flex-wrap gap-2">
          {getSuggestedPrompts().map((p, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSend(p.query)}
              disabled={isSending}
              className="text-[10px] font-medium px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-50 disabled:pointer-events-none transition-all duration-200"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT INPUT BAR */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputValue);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isSending}
            placeholder="Ask anything about this Salesforce context..."
            className="flex-1 text-xs p-3 glass-input border-slate-800 font-medium"
            id="chat-input"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/10 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-600 disabled:shadow-none disabled:border-slate-800 border border-transparent transition-all flex items-center justify-center shrink-0"
            id="btn-send"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
