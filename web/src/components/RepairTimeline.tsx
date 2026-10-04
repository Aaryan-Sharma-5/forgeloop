import React, { useState } from "react";
import type { ServerEvent } from "../types.ts";

export interface RepairTimelineProps {
  events: ServerEvent[];
}

export const RepairTimeline: React.FC<RepairTimelineProps> = ({ events }) => {
  const [showLog, setShowLog] = useState(false);

  if (!events || events.length === 0) {
    return (
      <div className="process-stepper-card">
        <div className="stepper-header">
          <span className="stepper-title">EXECUTION PIPELINE</span>
          <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>Awaiting intent to begin</span>
        </div>
        <div className="stepper-track">
          <span className="step-node">01 INTENT</span>
          <span className="step-arrow">→</span>
          <span className="step-node">02 GENERATE</span>
          <span className="step-arrow">→</span>
          <span className="step-node">03 VERIFY</span>
          <span className="step-arrow">→</span>
          <span className="step-node">04 REPAIR</span>
          <span className="step-arrow">→</span>
          <span className="step-node">05 PASS</span>
        </div>
      </div>
    );
  }

  // Derive execution stages from event history
  const hasIntent = events.some((e) => e.type === "INTENT_RECEIVED" || e.type === "SESSION_STARTED");
  const hasGenerated = events.some((e) => e.type === "LEVEL_GENERATED");
  const failedEvents = events.filter(
    (e) => e.type === "VERIFICATION_COMPLETED" && (e as any).result?.status === "FAILED"
  );
  const hasFailed = failedEvents.length > 0;
  const hasRepair = events.some((e) => e.type === "PATCH_PROPOSED" || e.type === "PATCH_APPLIED" || e.type === "REPAIR_STARTED");
  const isPass = events.some(
    (e) =>
      (e.type === "VERIFICATION_COMPLETED" && (e as any).result?.status === "PASSED") ||
      (e.type === "SESSION_COMPLETED" && (e as any).success)
  );

  return (
    <div className="process-stepper-card">
      <div className="stepper-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="stepper-title">EXECUTION PIPELINE</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", background: "var(--bg-surface-subtle)", padding: "1px 6px", borderRadius: 3 }}>
            {events.length} EVENTS
          </span>
        </div>

        <button
          onClick={() => setShowLog(!showLog)}
          style={{
            background: "transparent",
            border: "none",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-secondary)",
            cursor: "pointer",
          }}
        >
          {showLog ? "Hide Event Log ▲" : "Inspect Event Log ▼"}
        </button>
      </div>

      {/* Horizontal Process Track */}
      <div className="stepper-track">
        <span className={`step-node ${hasIntent ? "completed" : ""}`}>
          01 INTENT
        </span>

        <span className="step-arrow">→</span>

        <span className={`step-node ${hasGenerated ? "completed" : hasIntent ? "active" : ""}`}>
          02 GENERATE
        </span>

        <span className="step-arrow">→</span>

        <span className={`step-node ${hasFailed ? "failed" : isPass ? "completed" : hasGenerated ? "active" : ""}`}>
          03 VERIFY
        </span>

        {hasFailed && (
          <>
            <span className="step-arrow">→</span>
            <span className="step-node failed">
              04 COUNTEREXAMPLE
            </span>

            <span className="step-arrow">→</span>
            <span className={`step-node ${hasRepair ? "active" : ""}`}>
              05 REPAIR
            </span>

            <span className="step-arrow">→</span>
            <span className={`step-node ${isPass ? "completed" : hasRepair ? "active" : ""}`}>
              06 RE-VERIFY
            </span>
          </>
        )}

        <span className="step-arrow">→</span>

        <span className={`step-node ${isPass ? "completed" : ""}`}>
          {hasFailed ? "07" : "04"} PASS
        </span>
      </div>

      {/* Expandable Raw Event Stream */}
      {showLog && (
        <div className="event-stream-container">
          {events.map((event, idx) => {
            let desc = "";
            if (event.type === "INTENT_RECEIVED") desc = `"${event.intent}"`;
            else if (event.type === "LEVEL_GENERATED") desc = `Grid ${event.level.width}×${event.level.height}`;
            else if (event.type === "VERIFICATION_COMPLETED") desc = `${event.result.status} (${event.phase})`;
            else if (event.type === "PATCH_PROPOSED") desc = `${event.patch.operations.length} operations proposed`;
            else if (event.type === "PATCH_APPLIED") desc = `Applied ${event.patch.operations.length} operations`;
            else if (event.type === "SESSION_COMPLETED") desc = event.success ? "Verified Playable" : "Failed";
            else if (event.type === "ERROR") desc = event.message;

            return (
              <div key={idx} className="event-log-row">
                <span className="event-log-step">{(idx + 1).toString().padStart(2, "0")}</span>
                <span className="event-log-type">{event.type}</span>
                <span className="event-log-payload">{desc}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
