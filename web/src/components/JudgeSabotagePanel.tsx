import React, { useState } from "react";

export interface JudgeSabotagePanelProps {
  onSabotage: (action: "DROP_HAZARD" | "CUT_BRIDGE", x?: number, y?: number) => Promise<void>;
  onRepair?: () => Promise<void>;
  canRepair?: boolean;
  disabled?: boolean;
}

export const JudgeSabotagePanel: React.FC<JudgeSabotagePanelProps> = ({
  onSabotage,
  onRepair,
  canRepair,
  disabled,
}) => {
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleAction = async (action: "DROP_HAZARD" | "CUT_BRIDGE") => {
    try {
      setLoading(true);
      setLastAction(action);
      await onSabotage(action);
    } catch (err: any) {
      alert(`Sabotage failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async () => {
    if (!onRepair) return;
    try {
      setRepairing(true);
      await onRepair();
    } catch (err: any) {
      alert(`Repair failed: ${err.message}`);
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-secondary)" }}>
          JUDGE SABOTAGE // FAILURE INJECTION
        </span>
        <span className="badge badge-warn">ADVERSARIAL STRESS</span>
      </div>

      <p style={{ fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.4 }}>
        Deliberately inject structural or lethal failures into the level to test the verifier's detection and the repair loop's autonomous recovery:
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          className="btn btn-danger"
          onClick={() => handleAction("CUT_BRIDGE")}
          disabled={disabled || loading || repairing}
          title="Excavates platform tiles along the solution path to create an uncrossable chasm"
        >
          {loading && lastAction === "CUT_BRIDGE" ? "INJECTING..." : "CUT PLATFORM BRIDGE"}
        </button>

        <button
          className="btn btn-danger"
          onClick={() => handleAction("DROP_HAZARD")}
          disabled={disabled || loading || repairing}
          title="Places a lethal hazard spike on the main traversal path"
        >
          {loading && lastAction === "DROP_HAZARD" ? "INJECTING..." : "INJECT LETHAL HAZARD"}
        </button>
      </div>

      {canRepair && (
        <div style={{
          padding: 12,
          background: "var(--color-fail-bg)",
          border: "1px solid var(--color-fail-border)",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: "var(--color-fail)" }}>
              LEVEL COMPROMISED // COUNTEREXAMPLE IDENTIFIED
            </span>
            <span className="badge badge-fail">UNPLAYABLE</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
            The authoritative BFS verifier has proven the sabotage broke reachability. Feed the failure telemetry into the surgical repair model:
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "10px 14px", fontSize: 12 }}
            onClick={() => void handleRepair()}
            disabled={repairing || loading}
          >
            {repairing ? "SYNTHESIZING REPAIR PATCH..." : "TRIGGER AUTONOMOUS REPAIR"}
          </button>
        </div>
      )}

      <div style={{
        padding: "8px 10px",
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--ink-muted)",
        lineHeight: 1.4,
      }}>
        PROTOCOL: Failure injection updates level state → BFSVerifier detects counterexample node → Autonomous repair generates minimal LevelPatch → BFSVerifier re-validates.
      </div>
    </div>
  );
};
