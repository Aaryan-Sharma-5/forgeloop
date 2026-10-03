import React from "react";
import type { LevelConstraints, VerificationResult } from "../types.ts";

export interface ConstraintPanelProps {
  constraints: LevelConstraints | null;
  verification: VerificationResult | null;
}

export const ConstraintPanel: React.FC<ConstraintPanelProps> = ({
  constraints,
  verification,
}) => {
  if (!constraints) {
    return (
      <div className="panel constraint-panel">
        <div className="panel-title">Constraint & Difficulty Matrix</div>
        <div className="empty-notice">Awaiting level constraints...</div>
      </div>
    );
  }

  const isVerified = verification?.status === "PASSED";
  const metrics = verification?.metrics;
  const measuredDiff = metrics?.difficulty;

  // Actual values derived from verifier (or N/A if failed or not yet run)
  const actualJumps = metrics ? metrics.critical_jumps_required : null;
  const actualPath = metrics ? metrics.action_sequence_length : null;
  const actualGrade = measuredDiff ? measuredDiff.grade : null;
  const actualScore = measuredDiff ? measuredDiff.score : null;

  const jumpsMatch =
    actualJumps !== null ? actualJumps >= constraints.required_jumps : null;
  const pathMatch =
    actualPath !== null ? actualPath >= constraints.min_path_length : null;
  const diffMatch =
    actualGrade !== null ? actualGrade === constraints.target_difficulty : null;

  return (
    <div className="panel constraint-panel">
      <div className="panel-header">
        <div className="panel-title">Constraint & Difficulty Matrix</div>
        <div className="disclaimer-badge">Declared vs Measured Truth</div>
      </div>

      <div className="matrix-table">
        <div className="matrix-row matrix-header-row">
          <span className="col-prop">Parameter</span>
          <span className="col-declared">Author Declared</span>
          <span className="col-measured">Verified Actual</span>
          <span className="col-status">Status</span>
        </div>

        {/* Target Difficulty */}
        <div className="matrix-row">
          <span className="col-prop">Target Difficulty</span>
          <span className="col-declared badge-declared">{constraints.target_difficulty}</span>
          <span className="col-measured">
            {actualGrade ? (
              <span className={`badge-measured ${actualGrade.toLowerCase()}`}>
                {actualGrade} (Score: {actualScore})
              </span>
            ) : (
              "—"
            )}
          </span>
          <span className="col-status">
            {diffMatch === null ? (
              "—"
            ) : diffMatch ? (
              <span className="pill-pass-small">MATCH</span>
            ) : (
              <span className="pill-fail-small">MISMATCH</span>
            )}
          </span>
        </div>

        {/* Required Jumps */}
        <div className="matrix-row">
          <span className="col-prop">Required Jumps</span>
          <span className="col-declared">≥ {constraints.required_jumps}</span>
          <span className="col-measured">
            {actualJumps !== null ? `${actualJumps} jumps` : "—"}
          </span>
          <span className="col-status">
            {jumpsMatch === null ? (
              "—"
            ) : jumpsMatch ? (
              <span className="pill-pass-small">SATISFIED</span>
            ) : (
              <span className="pill-fail-small">VIOLATED</span>
            )}
          </span>
        </div>

        {/* Min Path Length */}
        <div className="matrix-row">
          <span className="col-prop">Min Path Length</span>
          <span className="col-declared">≥ {constraints.min_path_length} steps</span>
          <span className="col-measured">
            {actualPath !== null ? `${actualPath} steps` : "—"}
          </span>
          <span className="col-status">
            {pathMatch === null ? (
              "—"
            ) : pathMatch ? (
              <span className="pill-pass-small">SATISFIED</span>
            ) : (
              <span className="pill-fail-small">VIOLATED</span>
            )}
          </span>
        </div>

        {/* No Trivial Route */}
        <div className="matrix-row">
          <span className="col-prop">No Trivial Walking Route</span>
          <span className="col-declared">
            {constraints.no_trivial_route ? "ENFORCED" : "OFF"}
          </span>
          <span className="col-measured">
            {isVerified
              ? actualJumps && actualJumps > 0
                ? "Bypasses Prevented"
                : "Straight Route"
              : verification?.status === "FAILED" &&
                verification.counterexample?.violated?.constraint === "no_trivial_route"
              ? "Trivial Route Found"
              : "—"}
          </span>
          <span className="col-status">
            {verification?.status === "FAILED" &&
            verification.counterexample?.violated?.constraint === "no_trivial_route" ? (
              <span className="pill-fail-small">BYPASS DETECTED</span>
            ) : isVerified ? (
              <span className="pill-pass-small">SECURE</span>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      <div className="matrix-footer-note">
        ✦ <em>AI level synthesis can declare arbitrary difficulty, but only deterministic state-space exploration establishes true gameplay hardness.</em>
      </div>
    </div>
  );
};
