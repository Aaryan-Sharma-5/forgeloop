import React, { useState } from "react";
import type { VerificationResult } from "../types.ts";

export interface VerificationPanelProps {
  verification: VerificationResult | null;
  isRunning?: boolean;
  onPlay?: () => void;
  onRepair?: () => void;
  isRepairing?: boolean;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  verification,
  isRunning,
  onPlay,
  onRepair,
  isRepairing,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (isRunning) {
    return (
      <div className="verification-card">
        <div className="verification-status-banner idle">
          <div className="status-headline">
            <span className="status-main-label" style={{ color: "var(--color-accent)" }}>
              <span className="spinner" style={{ marginRight: 8, borderColor: "rgba(30, 64, 175, 0.2)", borderTopColor: "var(--color-accent)" }}></span>
              SEARCHING STATE SPACE
            </span>
            <span className="status-sub-label">Exhaustive BFS verification under canonical discrete physics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="verification-card">
        <div className="verification-status-banner idle">
          <div className="status-headline">
            <span className="status-main-label">AWAITING LEVEL</span>
            <span className="status-sub-label">Describe design intent above and click Generate & Verify.</span>
          </div>
        </div>
      </div>
    );
  }

  const isPassed = verification.status === "PASSED";
  const metrics = verification.metrics;

  return (
    <div className="verification-card">
      {/* 1. Core Verification Status Banner */}
      <div className={`verification-status-banner ${isPassed ? "pass" : "fail"}`}>
        <div className="status-headline">
          <span className="status-main-label">
            {isPassed ? "VERIFIED PLAYABLE" : "VERIFICATION FAILED"}
          </span>
          <span className="status-sub-label">
            {isPassed
              ? "All reachability and design constraints deterministically verified."
              : verification.counterexample?.reason || "Goal unreachable or physical obstacle collision detected."}
          </span>
        </div>
      </div>

      {/* 2. Key Metrics Table (Subtle rules, editorial styling) */}
      {isPassed ? (
        <>
          <table className="metrics-editorial-table">
            <tbody>
              <tr>
                <td className="label">Path Length</td>
                <td className="value">{verification.action_sequence.length} actions</td>
              </tr>
              <tr>
                <td className="label">Required Jumps</td>
                <td className="value">{metrics.critical_jumps_required} jumps</td>
              </tr>
              <tr>
                <td className="label">Difficulty Tier</td>
                <td className="value highlight-green">
                  {metrics.difficulty?.grade ?? "MEDIUM"} (Score {metrics.difficulty?.score ?? 0})
                </td>
              </tr>
              <tr>
                <td className="label">States Explored</td>
                <td className="value">{metrics.states_explored} states</td>
              </tr>
            </tbody>
          </table>

          {/* Primary CTA */}
          {onPlay && (
            <button className="btn btn-success btn-lg" onClick={onPlay} style={{ width: "100%" }}>
              PLAY VERIFIED LEVEL
            </button>
          )}

          {/* Expandable Technical Proof */}
          <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 10 }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: "transparent",
                border: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-secondary)",
                cursor: "pointer",
                padding: "4px 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{showDetails ? "▾ Hide" : "▸ Show"} Action Sequence Breakdown ({verification.action_sequence.length} steps)</span>
            </button>

            {showDetails && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
                {verification.action_sequence.map((action, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      background: "var(--bg-surface-subtle)",
                      border: "1px solid var(--border-rule)",
                      borderRadius: 3,
                      padding: "2px 6px",
                      color: "var(--ink-primary)",
                    }}
                  >
                    {idx + 1}. {action}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Failure & Counterexample Telemetry Callout */}
          <div className="counterexample-callout">
            <div className="ce-header">
              <span className="ce-title">COUNTEREXAMPLE TELEMETRY</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-fail)", fontWeight: 700 }}>
                {verification.counterexample.status}
              </span>
            </div>

            <p className="ce-reason">
              {verification.counterexample.reason}
            </p>

            <div className="ce-grid">
              <div className="ce-item">
                <span className="ce-item-label">Failure Node:</span>
                <span className="ce-item-val">
                  ({verification.counterexample.failure_node.x}, {verification.counterexample.failure_node.y})
                </span>
              </div>

              {verification.counterexample.collision_at && (
                <div className="ce-item">
                  <span className="ce-item-label">Collision:</span>
                  <span className="ce-item-val">
                    ({verification.counterexample.collision_at.x}, {verification.counterexample.collision_at.y})
                  </span>
                </div>
              )}

              {verification.counterexample.attempted_action && (
                <div className="ce-item">
                  <span className="ce-item-label">Attempt:</span>
                  <span className="ce-item-val">
                    {verification.counterexample.attempted_action}
                  </span>
                </div>
              )}

              {verification.counterexample.gap_to_goal && (
                <div className="ce-item">
                  <span className="ce-item-label">Gap to Goal:</span>
                  <span className="ce-item-val">
                    {verification.counterexample.gap_to_goal.manhattan_distance} tiles
                  </span>
                </div>
              )}
            </div>

            {verification.counterexample.violated && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--color-fail)", borderTop: "1px dashed var(--color-fail-border)", paddingTop: 6 }}>
                <strong>Violated Constraint:</strong> {verification.counterexample.violated.constraint} (Required: {verification.counterexample.violated.required}, Measured: {verification.counterexample.violated.actual})
              </div>
            )}
          </div>

          {/* Primary Repair CTA */}
          {onRepair && (
            <button
              className="btn btn-primary btn-lg"
              onClick={onRepair}
              disabled={isRepairing}
              style={{ width: "100%" }}
            >
              {isRepairing ? (
                <>
                  <span className="spinner"></span> REPAIRING LEVEL...
                </>
              ) : (
                "TRIGGER AUTONOMOUS REPAIR"
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
