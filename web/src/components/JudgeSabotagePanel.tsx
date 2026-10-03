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
    <div className="panel sabotage-panel">
      <div className="panel-header">
        <div className="panel-title">Judge Sabotage Sandbox</div>
        <span className="sabotage-badge">Live Counterexample Injection</span>
      </div>

      <p className="panel-desc">
        Actively test ForgeLoop's autonomous recovery by deliberately sabotaging this verified level:
      </p>

      <div className="sabotage-buttons">
        <button
          className="btn btn-sabotage hazard-btn"
          onClick={() => handleAction("DROP_HAZARD")}
          disabled={disabled || loading || repairing}
          title="Places a lethal hazard spike on the main path"
        >
          {loading && lastAction === "DROP_HAZARD" ? "Injecting..." : "⚡ Drop Lethal Hazard Spike"}
        </button>

        <button
          className="btn btn-sabotage bridge-btn"
          onClick={() => handleAction("CUT_BRIDGE")}
          disabled={disabled || loading || repairing}
          title="Removes a platform tile to create an impossible chasm"
        >
          {loading && lastAction === "CUT_BRIDGE" ? "Injecting..." : "✂ Cut Platform Bridge"}
        </button>
      </div>

      {canRepair && (
        <div style={{ marginTop: "16px", padding: "12px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid var(--green)", borderRadius: "6px" }}>
          <div style={{ color: "var(--green)", fontWeight: 700, marginBottom: "6px", fontSize: "12px" }}>
            LEVEL CURRENTLY BROKEN (COUNTEREXAMPLE DETECTED)
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px" }}>
            Trigger the counterexample-guided repair loop to synthesize a surgical patch and restore verified playability:
          </p>
          <button
            className="btn btn-primary"
            style={{ width: "100%", background: "var(--green)", color: "#000" }}
            onClick={() => void handleRepair()}
            disabled={repairing || loading}
          >
            {repairing ? "⚙ SYNTHESIZING REPAIR PATCH..." : "🔧 TRIGGER AUTONOMOUS REPAIR"}
          </button>
        </div>
      )}

      <div className="sabotage-note">
        ✦ <em>Judge action instantly breaks verified status → machine verifier detects failure → AI repairer synthesizes patch to restore playability.</em>
      </div>
    </div>
  );
};
