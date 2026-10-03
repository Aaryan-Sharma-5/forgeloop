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
      <div className="panel verification-panel running">
        <div className="panel-title">Deterministic Verifier</div>
        <div className="verifier-running-indicator">
          <span className="spinner"></span> Running exhaustive BFS reachability search...
        </div>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="panel verification-panel idle">
        <div className="panel-title">Deterministic Verifier</div>
        <div className="empty-notice">Awaiting level synthesis...</div>
      </div>
    );
  }

  const isPassed = verification.status === "PASSED";

  return (
    <div className={`panel verification-panel ${isPassed ? "status-pass" : "status-fail"}`}>
      <div className="panel-header">
        <div className="panel-title">Machine Verification Ground Truth</div>
        <div className={`status-pill ${isPassed ? "pill-pass" : "pill-fail"}`}>
          {isPassed ? "✔ PASSED (PLAYABLE)" : "✖ FAILED (UNPLAYABLE)"}
        </div>
      </div>

      {isPassed ? (
        <div className="verification-details pass-details">
          <div className="metric-row">
            <span className="metric-label">Verified Action Sequence:</span>
            <div className="action-tags">
              {verification.action_sequence.map((action, idx) => (
                <span key={idx} className="action-tag">
                  {action}
                </span>
              ))}
            </div>
          </div>

          <div className="metrics-grid">
            <div className="metric-box">
              <span className="metric-num">{verification.action_sequence.length}</span>
              <span className="metric-name">Solution Steps</span>
            </div>
            <div className="metric-box">
              <span className="metric-num">{verification.metrics.critical_jumps_required}</span>
              <span className="metric-name">Jumps Required</span>
            </div>
            <div className="metric-box">
              <span className="metric-num">{verification.metrics.states_explored}</span>
              <span className="metric-name">States Explored</span>
            </div>
            <div className="metric-box highlight">
              <span className="metric-num">{verification.metrics.difficulty?.score ?? "N/A"}</span>
              <span className="metric-name">
                Difficulty Score ({verification.metrics.difficulty?.grade ?? "UNRATED"})
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="verification-details fail-details">
          <div className="counterexample-card">
            <div className="card-header">
              <span className="ce-status-badge">{verification.counterexample.status}</span>
              <span className="ce-reason">{verification.counterexample.reason}</span>
            </div>

            {verification.counterexample.violated && (
              <div className="violation-box">
                <div className="violation-row">
                  <span className="violation-label">Violated Constraint:</span>
                  <span className="violation-val strong">{verification.counterexample.violated.constraint}</span>
                </div>
                <div className="violation-row">
                  <span className="violation-label">Required:</span>
                  <span className="violation-val">{verification.counterexample.violated.required}</span>
                  <span className="violation-label">Actual:</span>
                  <span className="violation-val error">{verification.counterexample.violated.actual}</span>
                </div>
                {verification.counterexample.violated.details && (
                  <div className="violation-details-text">
                    {verification.counterexample.violated.details}
                  </div>
                )}
              </div>
            )}

            <div className="metrics-grid failure-grid">
              <div className="metric-box">
                <span className="metric-num">
                  ({verification.counterexample.failure_node.x}, {verification.counterexample.failure_node.y})
                </span>
                <span className="metric-name">Failure Node</span>
              </div>

              {verification.counterexample.gap_to_goal && (
                <div className="metric-box">
                  <span className="metric-num">
                    {verification.counterexample.gap_to_goal.manhattan_distance}
                  </span>
                  <span className="metric-name">Gap to Goal (Manhattan)</span>
                </div>
              )}

              {verification.counterexample.collision_at && (
                <div className="metric-box error-box">
                  <span className="metric-num">
                    ({verification.counterexample.collision_at.x}, {verification.counterexample.collision_at.y})
                  </span>
                  <span className="metric-name">Collision At</span>
                </div>
              )}

              <div className="metric-box">
                <span className="metric-num">{verification.metrics.states_explored}</span>
                <span className="metric-name">Explored States</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
