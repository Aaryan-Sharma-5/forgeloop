import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './lib/api';
import { subscribeToSessionEvents } from './lib/events';
import type {
  Level,
  LevelSpec,
  VerificationResult,
  LevelPatch,
  ServerEvent,
  GameState,
  PhysicsConfig,
} from './types';

import { LevelCanvas } from './components/LevelCanvas';
import { VerificationPanel } from './components/VerificationPanel';
import { ConstraintPanel } from './components/ConstraintPanel';
import { RepairTimeline } from './components/RepairTimeline';
import { JudgeSabotagePanel } from './components/JudgeSabotagePanel';
import { PhysicsRegressionPanel } from './components/PhysicsRegressionPanel';
import { PlayMode } from './components/PlayMode';
import { BenchmarkPanel } from './components/BenchmarkPanel';

const SAMPLE_PROMPTS = [
  { label: 'EASY TUTORIAL', prompt: 'Create an easy tutorial level with 1 short gap' },
  { label: 'CHASM HAZARDS', prompt: 'Design a level with dangerous hazard chasms' },
  { label: 'HARD PLATFORMER', prompt: 'Create a hard level with multiple consecutive jumps' },
  { label: 'HIGH DIFFICULTY', prompt: 'Construct an expert challenge with strict timing and hazards' },
];

export const App: React.FC = () => {
  // Session State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [intent, setIntent] = useState<string>('Create an easy tutorial level with 1 short gap');
  const [levelSpec, setLevelSpec] = useState<LevelSpec | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [latestPatch, setLatestPatch] = useState<LevelPatch | null>(null);
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [status, setStatus] = useState<string>('IDLE');
  
  // UI & Network State
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'verification' | 'constraints' | 'sabotage' | 'physics' | 'play'>('verification');
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);

  // Play Mode Player
  const [playerState, setPlayerState] = useState<GameState | null>(null);

  // Cleanup ref for SSE
  const sseCleanupRef = useRef<(() => void) | null>(null);

  // Health check on mount
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await api.checkHealth();
        if (isMounted) setServerOnline(res.status === 'ok');
      } catch {
        if (isMounted) setServerOnline(false);
      }
    };
    void checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (sseCleanupRef.current) {
        sseCleanupRef.current();
      }
    };
  }, []);

  // Handle incoming server events to update state
  const handleServerEvent = useCallback((event: ServerEvent) => {
    setEvents((prev) => {
      if (prev.some((e) => e.type === event.type && (e as any).timestamp === (event as any).timestamp)) return prev;
      return [...prev, event];
    });

    switch (event.type) {
      case 'SPEC_GENERATED':
        setLevelSpec(event.spec);
        break;

      case 'LEVEL_GENERATED':
        setLevel(event.level);
        break;

      case 'VERIFICATION_COMPLETED':
        setVerification(event.result);
        setStatus(event.result.status === 'PASSED' ? 'VERIFIED' : 'FAILED');
        break;

      case 'PATCH_PROPOSED':
        setLatestPatch(event.patch);
        break;

      case 'PATCH_APPLIED':
        setLatestPatch(event.patch);
        setLevel(event.level);
        break;

      case 'REPAIR_COMPLETED':
        if (event.success) {
          setStatus('VERIFIED');
          setLevel(event.finalLevel);
        } else {
          setStatus('FAILED');
        }
        break;

      case 'SESSION_COMPLETED':
        setStatus(event.success ? 'VERIFIED' : 'FAILED');
        setLevel(event.finalLevel);
        setVerification(event.verification);
        break;

      case 'ERROR':
        setStatus('FAILED');
        setErrorMessage(event.message);
        break;
    }
  }, []);

  // Start new synthesis session
  const handleGenerate = async (intentToRun?: string) => {
    const targetIntent = intentToRun || intent;
    if (!targetIntent.trim()) return;

    if (sseCleanupRef.current) {
      sseCleanupRef.current();
      sseCleanupRef.current = null;
    }

    setErrorMessage(null);
    setStatus('GENERATING');
    setLevelSpec(null);
    setLevel(null);
    setVerification(null);
    setLatestPatch(null);
    setEvents([]);
    setPlayerState(null);
    setActiveTab('verification');

    try {
      const { sessionId: newSessionId, state } = await api.createSession(targetIntent);
      setSessionId(newSessionId);

      if (state) {
        setStatus(state.terminalState === 'COMPLETED' ? 'VERIFIED' : state.terminalState);
        if (state.spec) setLevelSpec(state.spec);
        if (state.level) setLevel(state.level);
        if (state.verification) setVerification(state.verification);
        if (state.events && state.events.length > 0) {
          setEvents(state.events);
        }
      }

      // Connect SSE
      const cleanup = subscribeToSessionEvents(newSessionId, {
        onEvent: handleServerEvent,
        onError: (err: Event) => {
          console.warn('SSE warning:', err);
          setSseConnected(false);
        },
      });
      sseCleanupRef.current = cleanup;
      setSseConnected(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('ERROR');
      setErrorMessage(msg);
    }
  };

  // Trigger Sabotage
  const handleSabotage = async (type: 'DROP_HAZARD' | 'CUT_BRIDGE', x?: number, y?: number) => {
    if (!sessionId) return;
    try {
      const snapshot = await api.sabotageSession(sessionId, type, x, y);
      if (snapshot.level) setLevel(snapshot.level);
      if (snapshot.verification) setVerification(snapshot.verification);
      if (snapshot.events) setEvents(snapshot.events);
      setActiveTab('verification');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Sabotage failed: ${msg}`);
    }
  };

  // Trigger Physics Regression
  const handleRegressPhysics = async (physics: Partial<PhysicsConfig>) => {
    if (!sessionId) return;
    try {
      const res = await api.sendCommand({
        type: 'REGRESS_PHYSICS',
        sessionId,
        physicsConfig: physics,
      });
      if (res.data && typeof res.data === 'object') {
        const data = res.data as any;
        if (data.verification) setVerification(data.verification);
        if (data.level) setLevel(data.level);
        if (data.events) setEvents(data.events);
      }
      setActiveTab('verification');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Physics regression failed: ${msg}`);
    }
  };

  const isVerifiedPass = verification?.status === 'PASSED';

  return (
    <div className="workspace-container">
      {/* Top Header */}
      <header className="forge-header">
        <div className="brand-group">
          <div className="logo-badge">FL</div>
          <div>
            <h1 className="title">FORGELOOP</h1>
            <div className="subtitle">Authoritative BFS Verification & Autonomous Repair Engine</div>
          </div>
        </div>

        <div className="header-meta">
          <div className="status-pill">
            <span className={`status-dot ${serverOnline === true ? 'dot-online' : serverOnline === false ? 'dot-offline' : 'dot-warn'}`}></span>
            <span>BACKEND: {serverOnline === true ? 'PORT 3000' : serverOnline === false ? 'UNREACHABLE' : 'CHECKING'}</span>
          </div>

          {sessionId && (
            <div className="status-pill">
              <span className={`status-dot ${sseConnected ? 'dot-online' : 'dot-muted'}`}></span>
              <span>SSE: {sseConnected ? 'STREAMING' : 'IDLE'}</span>
            </div>
          )}

          <button className="btn btn-secondary btn-sm" onClick={() => setIsBenchmarkOpen(true)}>
            📊 Benchmark Ablation
          </button>
        </div>
      </header>

      {/* Main Command Bar */}
      <section className="command-bar">
        <div className="input-wrap">
          <span className="terminal-prefix">&gt; INTENT:</span>
          <input
            type="text"
            className="intent-input"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleGenerate();
            }}
            placeholder="Type platformer intent: e.g. 'Build a level with 2 chasms and high jump requirement'..."
            disabled={status === 'GENERATING'}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => void handleGenerate()}
          disabled={status === 'GENERATING' || !intent.trim()}
        >
          {status === 'GENERATING' ? (
            <>
              <span className="spinner"></span> SYNTHESIZING...
            </>
          ) : (
            '⚡ COMPILE & VERIFY'
          )}
        </button>
      </section>

      {/* Sample Presets */}
      <div className="presets-row">
        <span className="presets-label">QUICK PROMPTS:</span>
        {SAMPLE_PROMPTS.map((sp) => (
          <button
            key={sp.label}
            className="preset-btn"
            onClick={() => {
              setIntent(sp.prompt);
              void handleGenerate(sp.prompt);
            }}
            disabled={status === 'GENERATING'}
          >
            {sp.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="error-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button className="btn-close-sm" onClick={() => setErrorMessage(null)}>✕</button>
        </div>
      )}

      {/* Workspace Grid */}
      <main className="forge-grid">
        {/* Left Column: Canvas & Timeline */}
        <section className="canvas-section">
          <div className="panel canvas-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="dot dot-cyan"></span>
                CANVAS GRID VIEW {level ? `(${level.width}×${level.height})` : ''}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {status && (
                  <span className={`badge ${
                    status === 'VERIFIED' ? 'badge-pass' :
                    status === 'FAILED' ? 'badge-fail' :
                    status === 'GENERATING' ? 'badge-warn' : 'badge-idle'
                  }`}>
                    {status}
                  </span>
                )}
                {latestPatch && (
                  <span className="badge badge-warn">
                    PATCH APPLIED: {latestPatch.operations.length} OPS
                  </span>
                )}
              </div>
            </div>

            <div className="canvas-container">
              <LevelCanvas
                level={level}
                verification={verification}
                latestPatch={latestPatch}
                playerState={activeTab === 'play' ? playerState : null}
              />
            </div>
          </div>

          {/* Repair Timeline */}
          <div className="panel timeline-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span className="dot dot-purple"></span>
                REPAIR TIMELINE ({events.length} EVENTS)
              </div>
              {sessionId && <span className="session-id-tag">ID: {sessionId.slice(0, 8)}...</span>}
            </div>
            <div className="timeline-container">
              <RepairTimeline events={events} />
            </div>
          </div>
        </section>

        {/* Right Column: Verification & Interactive Diagnostics */}
        <section className="diagnostics-section">
          {/* Navigation Tabs */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'verification' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('verification')}
            >
              VERIFIER RESULTS
            </button>
            <button
              className={`tab-btn ${activeTab === 'constraints' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('constraints')}
            >
              CONSTRAINTS
            </button>
            <button
              className={`tab-btn ${activeTab === 'sabotage' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('sabotage')}
            >
              JUDGE SABOTAGE
            </button>
            <button
              className={`tab-btn ${activeTab === 'physics' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('physics')}
            >
              PHYSICS REGRESSION
            </button>
            <button
              className={`tab-btn ${activeTab === 'play' ? 'tab-active' : ''} ${!isVerifiedPass ? 'tab-disabled' : ''}`}
              onClick={() => {
                if (isVerifiedPass) setActiveTab('play');
              }}
              title={!isVerifiedPass ? 'Play Mode unlocks only after level passes machine verification' : 'Play verified level'}
            >
              PLAY MODE {!isVerifiedPass && '🔒'}
            </button>
          </div>

          {/* Tab Panes */}
          <div className="tab-pane-container">
            {activeTab === 'verification' && (
              <VerificationPanel verification={verification} />
            )}

            {activeTab === 'constraints' && (
              <ConstraintPanel
                constraints={levelSpec?.constraints || level?.constraints || null}
                verification={verification}
              />
            )}

            {activeTab === 'sabotage' && (
              <JudgeSabotagePanel
                onSabotage={handleSabotage}
                disabled={!level}
              />
            )}

            {activeTab === 'physics' && (
              <PhysicsRegressionPanel
                onRegressPhysics={handleRegressPhysics}
                disabled={!level}
              />
            )}

            {activeTab === 'play' && level && (
              <PlayMode
                level={level}
                isVerifiedPlayable={isVerifiedPass}
                onPlayerStateChange={setPlayerState}
              />
            )}
          </div>
        </section>
      </main>

      {/* Benchmark Modal */}
      <BenchmarkPanel
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </div>
  );
};

export default App;
