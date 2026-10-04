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
      <div className="canvas-placeholder" style={{ padding: "20px 14px", textAlign: "left" }}>
        <p className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Awaiting level constraints specification.
        </p>
      </div>
    );
  }

  const metrics = verification?.metrics;
  const measuredDiff = metrics?.difficulty;

  // Actual values derived from verifier
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-secondary)" }}>
          SPECIFICATION // DECLARED VS VERIFIED
        </span>
        <span className="badge badge-idle">AUTHORITATIVE CHECK</span>
      </div>

      <table className="comparison-table">
        <thead>
          <tr>
            <th>CONSTRAINT</th>
            <th>DECLARED</th>
            <th>VERIFIED</th>
            <th>EVALUATION</th>
          </tr>
        </thead>
        <tbody>
          {/* Target Difficulty */}
          <tr className={diffMatch === false ? "error-row" : ""}>
            <td style={{ fontWeight: 700 }}>DIFFICULTY TIER</td>
            <td>{constraints.target_difficulty}</td>
            <td>
              {actualGrade ? `${actualGrade} (${actualScore})` : "—"}
            </td>
            <td>
              {diffMatch === null ? (
                <span className="text-muted">—</span>
              ) : diffMatch ? (
                <span className="text-green font-bold">MATCH</span>
              ) : (
                <span className="text-red font-bold">MISMATCH</span>
              )}
            </td>
          </tr>

          {/* Required Jumps */}
          <tr className={jumpsMatch === false ? "error-row" : ""}>
            <td style={{ fontWeight: 700 }}>REQUIRED JUMPS</td>
            <td>≥ {constraints.required_jumps}</td>
            <td>{actualJumps !== null ? `${actualJumps} jumps` : "—"}</td>
            <td>
              {jumpsMatch === null ? (
                <span className="text-muted">—</span>
              ) : jumpsMatch ? (
                <span className="text-green font-bold">SATISFIED</span>
              ) : (
                <span className="text-red font-bold">VIOLATED</span>
              )}
            </td>
          </tr>

          {/* Min Path Length */}
          <tr className={pathMatch === false ? "error-row" : ""}>
            <td style={{ fontWeight: 700 }}>MIN PATH ACTIONS</td>
            <td>≥ {constraints.min_path_length}</td>
            <td>{actualPath !== null ? `${actualPath} actions` : "—"}</td>
            <td>
              {pathMatch === null ? (
                <span className="text-muted">—</span>
              ) : pathMatch ? (
                <span className="text-green font-bold">SATISFIED</span>
              ) : (
                <span className="text-red font-bold">VIOLATED</span>
              )}
            </td>
          </tr>

          {/* No Trivial Route */}
          <tr>
            <td style={{ fontWeight: 700 }}>NO TRIVIAL ROUTE</td>
            <td>{constraints.no_trivial_route ? "REQUIRED" : "OPTIONAL"}</td>
            <td>
              {actualJumps !== null
                ? actualJumps > 0
                  ? "NON-TRIVIAL"
                  : "FLAT ROUTE"
                : "—"}
            </td>
            <td>
              {actualJumps !== null ? (
                actualJumps > 0 ? (
                  <span className="text-green font-bold">SATISFIED</span>
                ) : (
                  <span className="text-red font-bold">BYPASSED</span>
                )
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
