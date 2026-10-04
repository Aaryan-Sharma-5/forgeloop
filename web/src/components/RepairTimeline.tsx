import React from "react";
import type { ServerEvent } from "../types.ts";

export interface RepairTimelineProps {
  events: ServerEvent[];
}

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="canvas-placeholder" style={{ padding: "20px 14px", textAlign: "left" }}>
        <p className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          Awaiting CEGIS execution trace. Trigger compilation to view state transitions.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline-stream">
      {events.map((event, index) => {
        let badgeClass = "badge-neutral";
        let seq = (index + 1).toString().padStart(2, "0");
        let title: string = event.type;
        let details: React.ReactNode = null;

        switch (event.type) {
          case "SESSION_STARTED":
            badgeClass = "badge-cyan";
            title = "SESSION INITIALIZED";
            details = <span>ID: <code>{event.sessionId}</code></span>;
            break;

          case "INTENT_RECEIVED":
            badgeClass = "badge-cyan";
            title = "INTENT RECEIVED";
            details = <span className="intent-quote">"{event.intent}"</span>;
            break;

          case "SPEC_GENERATED":
            badgeClass = "badge-cyan";
            title = "SPEC_IR GENERATED";
            details = (
              <span>
                {event.spec.platforms.length} Platforms, {event.spec.hazards.length} Hazards | Target: {event.spec.constraints.target_difficulty}
              </span>
            );
            break;

          case "LEVEL_GENERATED":
            badgeClass = "badge-cyan";
            title = "DISCRETE GRID COMPILED";
            details = <span>Dimensions: {event.level.width} × {event.level.height}</span>;
            break;

          case "VERIFICATION_STARTED":
            badgeClass = "badge-neutral";
            title = `BFS VERIFICATION (${event.phase})`;
            if (event.attempt) {
              details = <span>Repair Attempt #{event.attempt}</span>;
            }
            break;

          case "VERIFICATION_COMPLETED":
            if (event.result.status === "PASSED") {
              badgeClass = "badge-pass";
              title = "VERIFICATION: PASS";
              details = (
                <span>
                  Path Length: {event.result.action_sequence.length} actions ({event.result.metrics.critical_jumps_required} jumps) | Score: {event.result.metrics.difficulty?.score ?? "N/A"}
                </span>
              );
            } else {
              badgeClass = "badge-fail";
              title = `VERIFICATION: FAILED (${event.result.counterexample.status})`;
              details = (
                <span>
                  Failure Node: ({event.result.counterexample.failure_node.x}, {event.result.counterexample.failure_node.y}) | {event.result.counterexample.reason}
                </span>
              );
            }
            break;

          case "REPAIR_STARTED":
            badgeClass = "badge-warn";
            title = `AUTONOMOUS REPAIR [ATTEMPT ${event.attempt}/${event.maxAttempts}]`;
            details = (
              <span>
                Counterexample at ({event.counterexample.failure_node.x}, {event.counterexample.failure_node.y}) fed to Surgical Repairer
              </span>
            );
            break;

          case "PATCH_PROPOSED":
            badgeClass = "badge-warn";
            title = `PATCH PROPOSED (${event.patch.operations.length} OP)`;
            details = (
              <div className="patch-ops-list">
                {event.patch.operations.map((op, opIdx) => (
                  <span key={opIdx} className="patch-op-tag">
                    ({op.x}, {op.y}) → {op.newTile}
                  </span>
                ))}
              </div>
            );
            break;

          case "PATCH_APPLIED":
            badgeClass = "badge-cyan";
            title = "PATCH APPLIED (IMMUTABLE DELTA)";
            details = <span>Level state updated. Triggering re-verification.</span>;
            break;

          case "REPAIR_COMPLETED":
            badgeClass = event.success ? "badge-pass" : "badge-fail";
            title = event.success
              ? "REPAIR SUCCEEDED (RE-VERIFIED PASS)"
              : `REPAIR EXHAUSTED (${event.attempts} ATTEMPTS)`;
            break;

          case "SESSION_COMPLETED":
            badgeClass = event.success ? "badge-pass" : "badge-fail";
            title = event.success ? "SESSION COMPLETED // VERIFIED" : "SESSION ENDED // UNVERIFIED";
            break;

          case "ERROR":
            badgeClass = "badge-fail";
            title = `SYSTEM ERROR [${event.code}]`;
            details = <span style={{ color: "var(--color-fail)" }}>{event.message}</span>;
            break;
        }

        return (
          <div key={index} className={`timeline-item ${badgeClass}`}>
            <span className="timeline-seq">{seq}</span>
            <span className="timeline-time">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <div className="timeline-content">
              <div className="timeline-title-row">
                <span className="timeline-title">{title}</span>
              </div>
              {details && <div className="timeline-details">{details}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
