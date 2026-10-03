import React from "react";
import type { ServerEvent } from "../types.ts";

export interface RepairTimelineProps {
  events: ServerEvent[];
}

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="panel timeline-panel">
        <div className="panel-title">Counterexample-Guided Synthesis Timeline</div>
        <div className="empty-notice">Timeline will populate as synthesis begins...</div>
      </div>
    );
  }

  return (
    <div className="panel timeline-panel">
      <div className="panel-header">
        <div className="panel-title">Counterexample-Guided Synthesis Timeline</div>
        <span className="event-count-badge">{events.length} Events</span>
      </div>

      <div className="timeline-stream">
        {events.map((event, index) => {
          let badgeClass = "badge-neutral";
          let title: string = event.type;
          let details: React.ReactNode = null;

          switch (event.type) {
            case "SESSION_STARTED":
              badgeClass = "badge-info";
              title = "Session Initialized";
              details = <span>Session ID: <code>{event.sessionId}</code></span>;
              break;

            case "INTENT_RECEIVED":
              badgeClass = "badge-info";
              title = "Design Intent Compiled";
              details = <span className="intent-quote">"{event.intent}"</span>;
              break;

            case "SPEC_GENERATED":
              badgeClass = "badge-cyan";
              title = "LevelSpec IR Synthesized";
              details = (
                <span>
                  {event.spec.platforms.length} Platforms, {event.spec.hazards.length} Hazards | Target: {event.spec.constraints.target_difficulty}
                </span>
              );
              break;

            case "LEVEL_GENERATED":
              badgeClass = "badge-cyan";
              title = "Discrete Level Grid Painted";
              details = <span>Grid Dimensions: {event.level.width} × {event.level.height}</span>;
              break;

            case "VERIFICATION_STARTED":
              badgeClass = "badge-neutral";
              title = `Verification Started (${event.phase})`;
              if (event.attempt) {
                details = <span>Repair Attempt #{event.attempt}</span>;
              }
              break;

            case "VERIFICATION_COMPLETED":
              if (event.result.status === "PASSED") {
                badgeClass = "badge-pass";
                title = "Machine Verification: PASSED";
                details = (
                  <span>
                    Solved in {event.result.action_sequence.length} actions ({event.result.metrics.critical_jumps_required} jumps) | Score: {event.result.metrics.difficulty?.score ?? "N/A"}
                  </span>
                );
              } else {
                badgeClass = "badge-fail";
                title = `Machine Verification: FAILED (${event.result.counterexample.status})`;
                details = (
                  <span>
                    Failure Node: ({event.result.counterexample.failure_node.x}, {event.result.counterexample.failure_node.y}) | {event.result.counterexample.reason}
                  </span>
                );
              }
              break;

            case "REPAIR_STARTED":
              badgeClass = "badge-warn";
              title = `Surgical Repair Loop — Attempt ${event.attempt}/${event.maxAttempts}`;
              details = (
                <span>
                  Feeding counterexample ({event.counterexample.reason}) to Surgical AI Repairer
                </span>
              );
              break;

            case "PATCH_PROPOSED":
              badgeClass = "badge-cyan";
              title = `LevelPatch Proposed (${event.patch.operations.length} op)`;
              details = (
                <div className="patch-ops-list">
                  {event.patch.operations.map((op, opIdx) => (
                    <span key={opIdx} className="patch-op-tag">
                      {op.type}: ({op.x}, {op.y}) → {op.newTile}
                    </span>
                  ))}
                </div>
              );
              break;

            case "PATCH_APPLIED":
              badgeClass = "badge-cyan";
              title = "Zero-Trust Validated Patch Applied";
              details = <span>Level immutably updated. Triggering re-verification.</span>;
              break;

            case "REPAIR_COMPLETED":
              badgeClass = event.success ? "badge-pass" : "badge-fail";
              title = event.success
                ? "Repair Successful: Verified Playable!"
                : `Repair Failed (Exhausted ${event.attempts} attempts)`;
              break;

            case "SESSION_COMPLETED":
              badgeClass = event.success ? "badge-pass" : "badge-fail";
              title = event.success ? "✔ Level Synthesis & Verification COMPLETED" : "✖ Session Ended Unverified";
              break;

            case "ERROR":
              badgeClass = "badge-fail";
              title = `Error: ${event.code}`;
              details = <span className="error-text">{event.message}</span>;
              break;
          }

          return (
            <div key={index} className={`timeline-item ${badgeClass}`}>
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-item-header">
                  <span className="timeline-title">{title}</span>
                  <span className="timeline-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {details && <div className="timeline-details">{details}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
