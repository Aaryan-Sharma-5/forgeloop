import React, { useState } from "react";
import type { PhysicsConfig } from "../types.ts";

export interface PhysicsRegressionPanelProps {
  onRegressPhysics: (config: Partial<PhysicsConfig>) => Promise<void>;
  disabled?: boolean;
}

export const PhysicsRegressionPanel: React.FC<PhysicsRegressionPanelProps> = ({
  onRegressPhysics,
  disabled,
}) => {
  const [shortJump, setShortJump] = useState(2);
  const [longJump, setLongJump] = useState(4);
  const [gravity, setGravity] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    try {
      setLoading(true);
      await onRegressPhysics({
        shortJumpDistance: shortJump,
        longJumpDistance: longJump,
        gravityStep: gravity,
      });
    } catch (err: any) {
      alert(`Physics regression failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetNerf = async () => {
    setLongJump(3);
    try {
      setLoading(true);
      await onRegressPhysics({
        shortJumpDistance: shortJump,
        longJumpDistance: 3,
        gravityStep: gravity,
      });
    } catch (err: any) {
      alert(`Physics regression failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetStandard = async () => {
    setShortJump(2);
    setLongJump(4);
    setGravity(1);
    try {
      setLoading(true);
      await onRegressPhysics({
        shortJumpDistance: 2,
        longJumpDistance: 4,
        gravityStep: 1,
      });
    } catch (err: any) {
      alert(`Physics regression failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-secondary)" }}>
          PHYSICS REGRESSION // TEST BENCH
        </span>
        <span className="badge badge-idle">MODEL INVALIDATION</span>
      </div>

      <p style={{ fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
        Perturb the underlying platformer physics constants to evaluate if previously verified levels break under engine rule regressions:
      </p>

      {/* Bench Parameters */}
      <div style={{
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-rule)",
        borderRadius: "var(--radius-sm)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
            SHORT JUMP REACH
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800 }}>{shortJump} TILES</span>
            <input
              type="range"
              min={1}
              max={3}
              value={shortJump}
              disabled={disabled || loading}
              onChange={(e) => setShortJump(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
            LONG JUMP REACH
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800 }}>{longJump} TILES</span>
            <input
              type="range"
              min={1}
              max={5}
              value={longJump}
              disabled={disabled || loading}
              onChange={(e) => setLongJump(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
            GRAVITY FALL RATE
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800 }}>{gravity} TILE/STEP</span>
            <input
              type="range"
              min={1}
              max={2}
              value={gravity}
              disabled={disabled || loading}
              onChange={(e) => setGravity(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Preset Bench Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => void handleResetStandard()}
          disabled={disabled || loading}
        >
          STANDARD (4T)
        </button>

        <button
          className="btn btn-danger btn-sm"
          onClick={() => void handlePresetNerf()}
          disabled={disabled || loading}
          title="Reduces long jump reach to 3 tiles to trigger a physics reachability failure"
        >
          NERFED (3T)
        </button>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => void handleApply()}
          disabled={disabled || loading}
        >
          {loading ? "APPLYING..." : "APPLY CUSTOM"}
        </button>
      </div>

      <div style={{
        padding: "8px 10px",
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--ink-muted)",
      }}>
        NOTE: Changing the movement model causes the BFS verifier to re-evaluate the level. Any gap requiring the nerfed jump immediately produces a counterexample.
      </div>
    </div>
  );
};
