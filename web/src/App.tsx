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
  { label: '01 Easy Tutorial', prompt: 'Create an easy tutorial level with 1 short gap' },
  { label: '02 Chasm Hazards', prompt: 'Design a level with dangerous hazard chasms' },
  { label: '03 Hard Platformer', prompt: 'Create a hard level with multiple consecutive jumps' },
  { label: '04 High Difficulty', prompt: 'Construct an expert challenge with strict timing and hazards' },
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondaryTab, setSecondaryTab] = useState<'details' | 'sabotage' | 'physics' | 'play'>('details');
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState<boolean>(false);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);

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
      const isDuplicate = prev.some(
        (e) =>
          e.type === event.type &&
          (e as any).timestamp === (event as any).timestamp &&
          (e as any).attempt === (event as any).attempt &&
          (e as any).phase === (event as any).phase
      );
      if (isDuplicate) return prev;
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
        setIsRepairing(false);
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
        setIsRepairing(false);
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
    setSecondaryTab('details');

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
        },
      });
      sseCleanupRef.current = cleanup;
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
      setStatus(snapshot.terminalState === 'COMPLETED' ? 'VERIFIED' : 'FAILED');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Sabotage failed: ${msg}`);
    }
  };

  // Trigger Autonomous Repair on damaged level
  const handleRepairSession = async () => {
    if (!sessionId) return;
    try {
      setIsRepairing(true);
      const snapshot = await api.repairSession(sessionId);
      if (snapshot.level) setLevel(snapshot.level);
      if (snapshot.verification) setVerification(snapshot.verification);
      if (snapshot.events) setEvents(snapshot.events);
      setStatus(snapshot.terminalState === 'COMPLETED' ? 'VERIFIED' : snapshot.terminalState);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Repair failed: ${msg}`);
    } finally {
      setIsRepairing(false);
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
        setStatus(data.verification?.status === 'PASSED' ? 'VERIFIED' : 'FAILED');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Physics regression failed: ${msg}`);
    }
  };

  const isVerifiedPass = verification?.status === 'PASSED';
  const isPlaying = secondaryTab === 'play' && isVerifiedPass;

  return (
    <div className="studio-layout">
      {/* 1. Header: Clean Editorial Game Tool Branding */}
      <header className="studio-header">
        <div className="brand-section">
          <span className="brand-badge">FL</span>
          <div className="brand-text">
            <h1>FORGELOOP</h1>
            <p>Counterexample-guided level design & verification</p>
          </div>
        </div>

        <div className="header-status-group">
          <div className="status-pill">
            <span className={`status-dot ${serverOnline === true ? 'online' : serverOnline === false ? 'offline' : 'generating'}`}></span>
            <span>{serverOnline === true ? 'ENGINE ONLINE' : serverOnline === false ? 'OFFLINE' : 'CHECKING'}</span>
          </div>

          <span className={`verification-badge ${
            status === 'VERIFIED' ? 'pass' :
            status === 'FAILED' ? 'fail' :
            status === 'GENERATING' ? 'generating' : 'idle'
          }`}>
            {status === 'VERIFIED' ? 'VERIFIED PLAYABLE' :
             status === 'FAILED' ? 'VERIFICATION FAILED' :
             status === 'GENERATING' ? 'GENERATING' : 'IDLE'}
          </span>

          <button className="btn btn-secondary btn-sm" onClick={() => setIsBenchmarkOpen(true)}>
            Benchmark Ablation
          </button>
        </div>
      </header>

      {/* 2. Design Intent Station */}
      <section className="intent-card">
        <div className="intent-row">
          <div className="intent-input-wrap">
            <span className="intent-label-tag">DESIGN INTENT</span>
            <input
              type="text"
              className="intent-input"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleGenerate();
              }}
              placeholder="Describe platformer rules: e.g. 'Build an easy level with one 2-tile gap'..."
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
                <span className="spinner"></span> GENERATING...
              </>
            ) : (
              'GENERATE & VERIFY'
            )}
          </button>
        </div>

        {/* Small, clean presets */}
        <div className="preset-strip">
          <span className="preset-title">Presets:</span>
          {SAMPLE_PROMPTS.map((sp) => (
            <button
              key={sp.label}
              className="preset-chip"
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
      </section>

      {/* Error Alert */}
      {errorMessage && (
        <div className="error-banner">
          <div>{errorMessage}</div>
          <button className="btn-close-sm" onClick={() => setErrorMessage(null)}>✕</button>
        </div>
      )}

      {/* 3. Main Workspace Grid: Dominant Canvas (Left) + Verification Station (Right) */}
      <main className="studio-grid">
        {/* Left Column: Level Viewport (Hero) */}
        <section className="viewport-card">
          <div className="viewport-header">
            <div className="viewport-title">
              <h2>Level Viewport</h2>
              <span className="viewport-dimensions">
                {level ? `(${level.width}×${level.height})` : '(12×8)'}
              </span>
            </div>

            <div className="legend-strip">
              <span className="legend-item"><span className="legend-dot ground"></span> Ground</span>
              <span className="legend-item"><span className="legend-dot hazard"></span> Hazard</span>
              <span className="legend-item"><span className="legend-dot start"></span> Start</span>
              <span className="legend-item"><span className="legend-dot goal"></span> Goal</span>
            </div>
          </div>

          <div className="canvas-viewport-wrap">
            <LevelCanvas
              level={level}
              verification={verification}
              latestPatch={latestPatch}
              playerState={isPlaying ? playerState : null}
            />
          </div>

          {/* Interactive Play Mode In-Canvas HUD Overlay */}
          {isPlaying && (
            <div className="play-hud-bar">
              <div className="hud-controls-hint">
                <span style={{ color: "var(--color-pass)", fontWeight: 700 }}>● PLAYING</span>
                <span><span className="key-badge">←</span> <span className="key-badge">→</span> Move</span>
                <span><span className="key-badge">Z</span> Short Jump</span>
                <span><span className="key-badge">X</span> Long Jump</span>
                <span><span className="key-badge">Space</span> Wait</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSecondaryTab('details')}>
                Exit Play Mode
              </button>
            </div>
          )}
        </section>

        {/* Right Column: Verification & Interactive Diagnostic Station */}
        <section className="station-column">
          {/* Card 1: Core Verification Readout & Primary Action */}
          <VerificationPanel
            verification={verification}
            isRunning={status === 'GENERATING'}
            onPlay={isVerifiedPass ? () => setSecondaryTab('play') : undefined}
            onRepair={verification?.status === 'FAILED' ? handleRepairSession : undefined}
            isRepairing={isRepairing}
          />

          {/* Card 2: Secondary Inspection & Testing Tools */}
          <div className="secondary-tools-card">
            <div className="secondary-nav-bar">
              <button
                className={`nav-tab-btn ${secondaryTab === 'details' ? 'active' : ''}`}
                onClick={() => setSecondaryTab('details')}
              >
                Constraints
              </button>
              <button
                className={`nav-tab-btn ${secondaryTab === 'sabotage' ? 'active' : ''}`}
                onClick={() => setSecondaryTab('sabotage')}
              >
                Judge Sabotage
              </button>
              <button
                className={`nav-tab-btn ${secondaryTab === 'physics' ? 'active' : ''}`}
                onClick={() => setSecondaryTab('physics')}
              >
                Physics Bench
              </button>
              <button
                className={`nav-tab-btn ${secondaryTab === 'play' ? 'active' : ''}`}
                onClick={() => {
                  if (isVerifiedPass) setSecondaryTab('play');
                }}
                disabled={!isVerifiedPass}
                title={!isVerifiedPass ? 'Play Mode unlocks after level passes verification' : 'Play verified level'}
              >
                Play Mode {!isVerifiedPass && '(Locked)'}
              </button>
            </div>

            <div className="secondary-pane-body">
              {secondaryTab === 'details' && (
                <ConstraintPanel
                  constraints={levelSpec?.constraints || level?.constraints || null}
                  verification={verification}
                />
              )}

              {secondaryTab === 'sabotage' && (
                <JudgeSabotagePanel
                  onSabotage={handleSabotage}
                  onRepair={handleRepairSession}
                  canRepair={verification?.status === 'FAILED'}
                  disabled={!level}
                />
              )}

              {secondaryTab === 'physics' && (
                <PhysicsRegressionPanel
                  onRegressPhysics={handleRegressPhysics}
                  disabled={!level}
                />
              )}

              {secondaryTab === 'play' && level && (
                <PlayMode
                  level={level}
                  isVerifiedPlayable={isVerifiedPass}
                  onPlayerStateChange={setPlayerState}
                />
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 4. Bottom: Horizontal Process Execution Stepper */}
      <RepairTimeline events={events} />

      {/* Benchmark Modal */}
      <BenchmarkPanel
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </div>
  );
};

export default App;
