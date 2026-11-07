import { useEffect, useState, useRef, useCallback } from 'react';
import { Incident, WsServerMessage, WsClientMessage, SystemInfo, User, SupabaseClient } from '@apex/shared';
import LogInvestigationPanel from './LogInvestigationPanel';
import SupabaseAuthBar from './SupabaseAuthBar';
import {
  registerNotificationServiceWorker,
  requestNotificationPermission,
  getNotificationPermission,
  sendDeviceNotification,
} from './notifications';

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);
const currentHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const WS_URL = import.meta.env.VITE_WS_URL || (isLocal ? `ws://${currentHost}:3001/ws` : `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${typeof window !== 'undefined' ? window.location.host : 'localhost'}/ws`);
const API_URL = import.meta.env.VITE_SERVER_URL || (isLocal ? `http://${currentHost}:3001` : (typeof window !== 'undefined' ? window.location.origin : ''));

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [aiAnalysisMap, setAiAnalysisMap] = useState<Record<string, { analysis: string; rootCause: string; mitigations: string[] }>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState<'inspector' | 'logs'>('inspector');
  const [mobileShowingDetails, setMobileShowingDetails] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  // Mobile & Desktop Real Notification State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [isTestingNotif, setIsTestingNotif] = useState<boolean>(false);
  const knownIncidentIdsRef = useRef<Set<string>>(new Set());

  // Register ServiceWorker on startup
  useEffect(() => {
    registerNotificationServiceWorker();
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    if (granted) {
      await sendDeviceNotification('🔔 APEX Mobile Notifications Enabled!', {
        body: 'Real-time alerts are now active on your phone. You will be alerted whenever an incident triggers.',
        severity: 'low',
        tag: 'apex-welcome'
      });
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    let perm = notifPermission;
    if (perm !== 'granted') {
      const granted = await requestNotificationPermission();
      perm = granted ? 'granted' : 'denied';
      setNotifPermission(perm);
      if (!granted) {
        setIsTestingNotif(false);
        return;
      }
    }

    await sendDeviceNotification('🚨 [CRITICAL] 504 Gateway Timeout Spiked', {
      body: 'Service payment-gateway p99 exceeded 2100ms. Tap to open APEX investigation on your phone.',
      severity: 'critical',
      tag: 'test-alert-' + Date.now()
    });
    setIsTestingNotif(false);
  };

  const handleUserChange = useCallback((u: User | null, client: SupabaseClient | null) => {
    setAuthUser(u);
    setSupabaseClient(client);
  }, []);

  const handleVercelTokenSynced = useCallback((token: string, teamId?: string) => {
    fetch(`${API_URL}/api/vercel/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, teamId }),
    }).catch((err) => console.warn('[Supabase Sync] Could not sync Vercel token with server:', err));
  }, []);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const isUnmountedRef = useRef(false);

  const handleSelectIncidentFromLog = (incidentId: string) => {
    const target = incidents.find((i) => i.id === incidentId);
    if (target) {
      setSelectedIncident(target);
      setViewMode('inspector');
      setMobileShowingDetails(true);
    } else {
      fetch(`${API_URL}/api/incidents/${incidentId}`)
        .then((res) => res.json())
        .then((d) => {
          if (d.success && d.data) {
            setSelectedIncident(d.data);
            setViewMode('inspector');
            setMobileShowingDetails(true);
          }
        })
        .catch((err) => console.warn('Could not fetch incident:', err));
    }
  };

  // Check Electron Preload API
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getSystemInfo().then(info => {
        setSystemInfo(info);
      }).catch(err => {
        console.error('Failed to get system info:', err);
      });
    }
  }, []);

  // WebSocket Connection
  const connectWs = useCallback(() => {
    if (isUnmountedRef.current) return;
    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) {
        ws.close();
        return;
      }
      setWsStatus('connected');
      const subscribeMsg: WsClientMessage = { type: 'subscribe_incidents' };
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsServerMessage = JSON.parse(event.data);
        if (msg.type === 'incident_created') {
          setIncidents((prev) => {
            const exists = prev.some((i) => i.id === msg.incident.id);
            if (exists) return prev;
            return [msg.incident, ...prev];
          });
          if (!knownIncidentIdsRef.current.has(msg.incident.id)) {
            knownIncidentIdsRef.current.add(msg.incident.id);
            sendDeviceNotification(`🚨 [${msg.incident.severity.toUpperCase()}] ${msg.incident.title}`, {
              body: `${msg.incident.affectedService}: ${msg.incident.description}`,
              severity: msg.incident.severity,
              tag: msg.incident.id,
            });
          }
        } else if (msg.type === 'incident_updated') {
          setIncidents((prev) =>
            prev.map((i) => (i.id === msg.incident.id ? msg.incident : i))
          );
          setSelectedIncident((curr) => (curr?.id === msg.incident.id ? msg.incident : curr));
        } else if (msg.type === 'ai_analysis_result') {
          setAiAnalysisMap((prev) => ({
            ...prev,
            [msg.incidentId]: {
              analysis: msg.analysis,
              rootCause: msg.suggestedRootCause,
              mitigations: msg.recommendedMitigations
            }
          }));
          setIsAnalyzing(false);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      if (!isUnmountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    connectWs();
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      socketRef.current?.close();
    };
  }, [connectWs]);

  // Polling fallback: syncs incidents every 6 seconds to keep alerts live even on Vercel or when mobile browsers sleep WS
  useEffect(() => {
    let isMounted = true;
    const fetchIncidents = () => {
      fetch(`${API_URL}/api/incidents`)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.success && Array.isArray(data.data)) {
            setIncidents(() => {
              if (knownIncidentIdsRef.current.size > 0) {
                data.data.forEach((inc: any) => {
                  if (!knownIncidentIdsRef.current.has(inc.id)) {
                    knownIncidentIdsRef.current.add(inc.id);
                    sendDeviceNotification(`🚨 [${(inc.severity || 'high').toUpperCase()}] ${inc.title}`, {
                      body: `${inc.affectedService || inc.service || 'APEX'}: ${inc.description || inc.summary || 'New incident reported'}`,
                      severity: inc.severity || 'high',
                      tag: inc.id,
                    });
                  }
                });
              } else {
                data.data.forEach((inc: any) => knownIncidentIdsRef.current.add(inc.id));
              }
              return data.data;
            });
            if (data.data.length > 0) {
              setSelectedIncident((curr) => curr || data.data[0]);
            }
          }
        })
        .catch((err) => console.warn('Could not sync incidents:', err));
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRequestAnalysis = (incidentId: string) => {
    setIsAnalyzing(true);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = {
        type: 'request_ai_analysis',
        incidentId
      };
      socketRef.current.send(JSON.stringify(msg));
    } else {
      // Fallback to HTTP
      fetch(`${API_URL}/api/incidents/${incidentId}/analyze`, { method: 'POST' })
        .then((res) => res.json())
        .then((res) => {
          if (res.success) {
            setAiAnalysisMap((prev) => ({
              ...prev,
              [incidentId]: {
                analysis: res.data.analysis,
                rootCause: res.data.suggestedRootCause,
                mitigations: res.data.recommendedMitigations
              }
            }));
          }
        })
        .finally(() => setIsAnalyzing(false));
    }
  };

  const handleAcknowledge = (incidentId: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = {
        type: 'acknowledge_incident',
        incidentId,
        status: 'investigating'
      };
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-3 sm:px-5 backdrop-blur shrink-0">
        <div className="flex h-14 items-center justify-between gap-2">
          {/* Logo & Title */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/20">
              A
            </div>
            <div className="truncate">
              <h1 className="text-xs sm:text-sm font-semibold tracking-wider text-slate-100 flex items-center gap-1.5 truncate">
                <span>APEX</span>
                <span className="hidden sm:inline text-xs font-normal text-indigo-400">NOVA Assistant</span>
              </h1>
              <p className="hidden sm:block text-[10px] text-slate-400">Phase 0 Foundation</p>
            </div>
          </div>

          {/* Center: View Switcher (Desktop) */}
          <div className="hidden md:flex items-center space-x-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => {
                setViewMode('inspector');
                setMobileShowingDetails(false);
              }}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                viewMode === 'inspector'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Incident Inspector
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`rounded px-3 py-1 text-xs font-medium transition flex items-center space-x-1.5 ${
                viewMode === 'logs'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Log Investigation</span>
              <span className="rounded bg-violet-900/60 border border-violet-700/50 px-1.5 py-0.2 text-[9px] font-mono text-violet-300">
                Pipeline
              </span>
            </button>
          </div>

          {/* Right: Status Indicators & Auth */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs shrink-0">
            {systemInfo && (
              <div className="hidden lg:block rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 text-[11px]">
                <span className="text-slate-500">Host:</span> {systemInfo.platform} ({systemInfo.arch})
              </div>
            )}

            <div className="flex items-center space-x-1.5 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px]">
              <span
                className={`h-2 w-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-emerald-400 ring-2 ring-emerald-500/30 animate-pulse'
                    : wsStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <span className="capitalize text-slate-300 hidden sm:inline">{wsStatus}</span>
            </div>

            {/* Real Mobile & Desktop Alert Button */}
            <button
              onClick={notifPermission === 'granted' ? handleTestNotification : handleEnableNotifications}
              disabled={isTestingNotif}
              title={
                notifPermission === 'granted'
                  ? 'Tap to trigger a real test phone notification with sound & vibration'
                  : 'Enable Mobile Notifications'
              }
              className={`flex items-center space-x-1.5 rounded px-2.5 py-1 text-[11px] font-semibold transition border ${
                notifPermission === 'granted'
                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 active:scale-95'
                  : 'border-amber-500/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 animate-pulse active:scale-95'
              }`}
            >
              <span>{notifPermission === 'granted' ? '⚡' : '🔔'}</span>
              <span className="inline">
                {isTestingNotif
                  ? 'Alerting...'
                  : notifPermission === 'granted'
                  ? 'Test Phone Alert'
                  : 'Enable Mobile Alerts'}
              </span>
            </button>

            {/* Supabase Google Auth */}
            <SupabaseAuthBar
              onUserChange={handleUserChange}
              onVercelTokenSynced={handleVercelTokenSynced}
            />
          </div>
        </div>

        {/* Mobile View Switcher Sub-bar (< md) */}
        <div className="flex md:hidden border-t border-slate-800/70 py-1.5 gap-1.5">
          <button
            onClick={() => {
              setViewMode('inspector');
              setMobileShowingDetails(false);
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium text-center transition ${
              viewMode === 'inspector'
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Incident Inspector
          </button>
          <button
            onClick={() => setViewMode('logs')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium text-center transition flex items-center justify-center gap-1.5 ${
              viewMode === 'logs'
                ? 'bg-violet-600 text-white shadow-md font-semibold'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>Log Investigation</span>
            <span className="rounded bg-violet-900/80 px-1 py-0.2 text-[9px] font-mono text-violet-200">
              Vercel
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Incident Feed */}
        <section
          className={`flex flex-col border-r border-slate-800 bg-slate-900/40 md:w-80 lg:w-96 shrink-0 transition-all ${
            viewMode === 'inspector' && mobileShowingDetails ? 'hidden md:flex' : 'w-full md:flex'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Incidents ({incidents.length})
            </h2>
            <button
              onClick={() => {
                fetch(`${API_URL}/api/incidents`)
                  .then((r) => r.json())
                  .then((d) => d.success && setIncidents(d.data));
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {incidents.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-slate-500">
                No active incidents detected.
              </div>
            ) : (
              incidents.map((incident) => {
                const isSelected = selectedIncident?.id === incident.id;
                const severityColor =
                  incident.severity === 'critical'
                    ? 'border-rose-500/50 bg-rose-950/20 text-rose-300'
                    : incident.severity === 'high'
                    ? 'border-amber-500/50 bg-amber-950/20 text-amber-300'
                    : 'border-blue-500/50 bg-blue-950/20 text-blue-300';

                return (
                  <div
                    key={incident.id}
                    onClick={() => {
                      setSelectedIncident(incident);
                      setViewMode('inspector');
                      setMobileShowingDetails(true);
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${severityColor}`}>
                        {incident.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {incident.status}
                      </span>
                    </div>

                    <h3 className="mt-2 text-xs font-medium text-slate-200 line-clamp-1">
                      {incident.title}
                    </h3>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Service: <span className="text-slate-300">{incident.affectedService}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Log Investigation OR Selected Incident Inspector */}
        {viewMode === 'logs' ? (
          <section className="flex flex-1 flex-col overflow-hidden bg-slate-950 w-full">
            <LogInvestigationPanel
              onSelectIncident={handleSelectIncidentFromLog}
              currentUser={authUser}
              supabaseClient={supabaseClient}
            />
          </section>
        ) : (
          <section
            className={`flex-1 flex-col overflow-y-auto bg-slate-950 p-4 sm:p-6 w-full ${
              !mobileShowingDetails ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Mobile Back Button */}
            <div className="md:hidden pb-2">
              <button
                onClick={() => setMobileShowingDetails(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition shadow-sm"
              >
                ← Back to Active Incidents
              </button>
            </div>

            {selectedIncident ? (
            <div className="max-w-4xl space-y-4 sm:space-y-6">
              {/* Incident Header */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <span className="rounded-md bg-indigo-950 border border-indigo-700 px-2 py-1 text-xs font-mono text-indigo-300">
                      {selectedIncident.affectedService}
                    </span>
                    <span className="text-xs text-slate-400">
                      Detected: {new Date(selectedIncident.detectedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {selectedIncident.status === 'detected' && (
                      <button
                        onClick={() => handleAcknowledge(selectedIncident.id)}
                        className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-2 sm:py-1.5 text-xs text-slate-200 transition"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      disabled={isAnalyzing}
                      onClick={() => handleRequestAnalysis(selectedIncident.id)}
                      className="flex-1 sm:flex-initial rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3.5 py-2 sm:py-1.5 text-xs font-medium text-white shadow-md shadow-indigo-600/30 transition text-center"
                    >
                      {isAnalyzing ? 'Analyzing with NOVA AI...' : 'Run Gemini Root-Cause Investigation'}
                    </button>
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-semibold text-white">
                  {selectedIncident.title}
                </h2>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  {selectedIncident.description}
                </p>
              </div>

              {/* AI Diagnosis Panel */}
              <div className="rounded-xl border border-indigo-900/40 bg-gradient-to-b from-indigo-950/20 to-slate-900/60 p-5 shadow-sm">
                <div className="flex items-center space-x-2 text-indigo-400">
                  <div className="h-2 w-2 rounded-full bg-indigo-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">
                    NOVA Intelligence & Root Cause Analysis
                  </h3>
                </div>

                {aiAnalysisMap[selectedIncident.id] ? (
                  <div className="mt-3 space-y-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-300">Summary: </span>
                      <span className="text-slate-300">{aiAnalysisMap[selectedIncident.id].analysis}</span>
                    </div>

                    <div className="rounded bg-slate-900/80 p-3 border border-slate-800">
                      <span className="font-semibold text-indigo-300">Probable Root Cause: </span>
                      <p className="mt-1 text-slate-200">{aiAnalysisMap[selectedIncident.id].rootCause}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-300">Recommended Mitigations:</span>
                      <ul className="mt-1 list-disc list-inside space-y-1 text-slate-300">
                        {aiAnalysisMap[selectedIncident.id].mitigations.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : selectedIncident.rootCauseAnalysis ? (
                  <div className="mt-3 text-xs text-slate-300">
                    <p className="font-medium text-indigo-300">Pre-computed Analysis:</p>
                    <p className="mt-1 text-slate-300">{selectedIncident.rootCauseAnalysis}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400 italic">
                    Click 'Run Gemini Root-Cause Investigation' to invoke server-side Gemini intelligence on this incident.
                  </p>
                )}
              </div>

              {/* Recommended Remediation Actions */}
              {selectedIncident.recommendedActions.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Remediation Playbook Steps
                  </h3>
                  <div className="mt-3 space-y-2">
                    {selectedIncident.recommendedActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs"
                      >
                        <div>
                          <p className="font-medium text-slate-200">{action.title}</p>
                          <p className="mt-0.5 text-slate-400">{action.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            Risk: {action.estimatedRisk}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Select an incident from the feed to view diagnostics and recommendations.
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
