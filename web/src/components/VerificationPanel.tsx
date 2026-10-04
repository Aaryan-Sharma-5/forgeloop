import React from "react";
import type { VerificationResult } from "../types.ts";

export interface VerificationPanelProps {
  verification: VerificationResult | null;
  isRunning?: boolean;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  verification,
  isRunning,
}) => {
  if (isRunning) {
    return (
      <div className="verification-panel">
        <div className="verification-status-stamp">
          <span className="stamp-label">VERIFIER STATUS</span>
          <span className="stamp-value" style={{ color: "var(--color-accent)" }}>
            <span className="spinner" style={{ marginRight: 6 }}></span> SEARCHING (BFS)
          </span>
        </div>
        <p className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Executing exhaustive breadth-first state reachability search...
        </p>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="verification-panel">
        <div className="verification-status-stamp">
          <span className="stamp-label">VERIFIER STATUS</span>
          <span className="stamp-value" style={{ color: "var(--ink-muted)" }}>AWAITING LEVEL</span>
        </div>
        <p className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Authoritative BFS reachability engine is idle. Compile a level to evaluate playability.
        </p>
      </div>
    );
  }

  const isPassed = verification.status === "PASSED";

  return (
    <div className="verification-panel">
      {/* Mechanical Status Stamp */}
      <div className={`verification-status-stamp ${isPassed ? "status-stamp-pass" : "status-stamp-fail"}`}>
        <span className="stamp-label">VERIFICATION STATUS</span>
        <span className={`stamp-value ${isPassed ? "pass" : "fail"}`}>
          {isPassed ? "PASS // PROVABLY PLAYABLE" : `FAILED // ${verification.counterexample.status}`}
        </span>
      </div>

      {isPassed ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Telemetry Readout Grid */}
          <div className="telemetry-grid">
            <div className="telemetry-cell">
              <span className="telemetry-label">REACHABILITY</span>
              <span className="telemetry-value" style={{ color: "var(--color-pass)" }}>VERIFIED</span>
            </div>
            <div className="telemetry-cell">
              <span className="telemetry-label">SOLUTION STEPS</span>
              <span className="telemetry-value">{verification.action_sequence.length} ACTIONS</span>
            </div>
            <div className="telemetry-cell">
              <span className="telemetry-label">CRITICAL JUMPS</span>
              <span className="telemetry-value">{verification.metrics.critical_jumps_required}</span>
            </div>
            <div className="telemetry-cell">
              <span className="telemetry-label">STATES EXPLORED</span>
              <span className="telemetry-value">{verification.metrics.states_explored}</span>
            </div>
            <div className="telemetry-cell" style={{ gridColumn: "span 2" }}>
              <span className="telemetry-label">EVALUATED DIFFICULTY</span>
              <span className="telemetry-value highlight">
                SCORE: {verification.metrics.difficulty?.score ?? "N/A"} [{verification.metrics.difficulty?.grade ?? "CALIBRATING"}]
              </span>
            </div>
          </div>

          {/* Action Sequence */}
          <div className="action-sequence-box">
            <span className="telemetry-label">PROVEN ACTION SEQUENCE</span>
            <div className="action-tags">
              {verification.action_sequence.map((action, idx) => (
                <span key={idx} className="action-tag">
                  {idx + 1}. {action}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Counterexample Telemetry Card */}
          <div className="counterexample-card">
            <div className="card-header">
              <span className="ce-status-badge">{verification.counterexample.status}</span>
              <span className="ce-reason">{verification.counterexample.reason}</span>
            </div>

            {verification.counterexample.violated && (
              <div className="violation-box">
                <div className="violation-row">
                  <span className="violation-label">VIOLATED CONSTRAINT:</span>
                  <span className="violation-val strong">{verification.counterexample.violated.constraint}</span>
                </div>
                <div className="violation-row">
                  <span className="violation-label">REQUIRED:</span>
                  <span className="violation-val">{verification.counterexample.violated.required}</span>
                  <span className="violation-label" style={{ marginLeft: 8 }}>MEASURED:</span>
                  <span className="violation-val error">{verification.counterexample.violated.actual}</span>
                </div>
                {verification.counterexample.violated.details && (
                  <div className="violation-details-text">
                    {verification.counterexample.violated.details}
                  </div>
                )}
              </div>
            )}

            <div className="telemetry-grid">
              <div className="telemetry-cell">
                <span className="telemetry-label">FAILURE NODE</span>
                <span className="telemetry-value error">
                  ({verification.counterexample.failure_node.x}, {verification.counterexample.failure_node.y})
                </span>
              </div>

              {verification.counterexample.collision_at ? (
                <div className="telemetry-cell">
                  <span className="telemetry-label">COLLISION POINT</span>
                  <span className="telemetry-value error">
                    ({verification.counterexample.collision_at.x}, {verification.counterexample.collision_at.y})
                  </span>
                </div>
              ) : (
                <div className="telemetry-cell">
                  <span className="telemetry-label">EXPLORED STATES</span>
                  <span className="telemetry-value">{verification.metrics.states_explored}</span>
                </div>
              )}

              {verification.counterexample.gap_to_goal && (
                <div className="telemetry-cell" style={{ gridColumn: "span 2" }}>
                  <span className="telemetry-label">GAP VECTOR TO GOAL</span>
                  <span className="telemetry-value">
                    ΔX: {verification.counterexample.gap_to_goal.dx} | ΔY: {verification.counterexample.gap_to_goal.dy} (MANHATTAN: {verification.counterexample.gap_to_goal.manhattan_distance})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
