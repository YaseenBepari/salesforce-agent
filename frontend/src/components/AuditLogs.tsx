import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileSpreadsheet, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface AuditLog {
  id: number;
  org_id: str;
  username: str;
  action_type: str;
  description: str;
  target_object: str;
  status: str;
  approved_by: str;
  created_at: str;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/audit/logs');
      const data = await response.json();
      if (response.ok) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr.toUpperCase()) {
      case 'APPROVED':
        return (
          <span className="slds-badge slds-badge-success flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="slds-badge slds-badge-warning flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" /> Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="slds-badge slds-badge-warning bg-rose-500/10 text-rose-400 border-rose-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" /> Rejected
          </span>
        );
      case 'FAILED':
        return (
          <span className="slds-badge slds-badge-warning bg-red-950/20 text-red-500 border-red-900/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-500" /> Failed
          </span>
        );
      default:
        return <span className="slds-badge slds-badge-info">{statusStr}</span>;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="glass-panel p-6 border-slate-800 bg-slate-900/15 flex flex-col h-full overflow-hidden" id="audit-logs-workspace">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider flex items-center gap-1.5">
              Security Validation Audit Log
            </h3>
            <p className="text-[10px] text-slate-400">Real-time tracking of AI proposed modifications</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 disabled:opacity-50 transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh List
        </button>
      </div>

      {/* TABLE PANEL */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center space-y-2">
            <FileSpreadsheet className="w-8 h-8 opacity-30" />
            <p className="text-xs font-medium italic">No transactions or modifications logged yet.</p>
            <p className="text-[10px] max-w-xs leading-normal">
              Ask Copilot to execute user changes or write modifications to test security approvals.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/40 text-slate-400 font-semibold">
                  <th className="p-3">Event Ref</th>
                  <th className="p-3">User Admin</th>
                  <th className="p-3">Proposed Action</th>
                  <th className="p-3">Target sObject</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-850/60 hover:bg-slate-900/10">
                    <td className="p-3 font-mono text-[10px] text-indigo-400">
                      #{log.id}
                    </td>
                    <td className="p-3 font-medium text-slate-200">
                      {log.username}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{log.action_type}</div>
                      <div className="text-[10px] text-slate-400">{log.description}</div>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-indigo-300">
                      {log.target_object || 'sObject'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="inline-flex justify-center w-full">
                        {getStatusBadge(log.status)}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-400">
                      {formatTimestamp(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default AuditLogs;
