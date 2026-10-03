import React, { useState } from "react";

export interface JudgeSabotagePanelProps {
  onSabotage: (action: "DROP_HAZARD" | "CUT_BRIDGE", x?: number, y?: number) => Promise<void>;
  disabled?: boolean;
}

export const JudgeSabotagePanel: React.FC<JudgeSabotagePanelProps> = ({
  onSabotage,
  disabled,
}) => {
  const [loading, setLoading] = useState(false);
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
          disabled={disabled || loading}
          title="Places a lethal hazard spike on the main path"
        >
          {loading && lastAction === "DROP_HAZARD" ? "Injecting..." : "⚡ Drop Lethal Hazard Spike"}
        </button>

        <button
          className="btn btn-sabotage bridge-btn"
          onClick={() => handleAction("CUT_BRIDGE")}
          disabled={disabled || loading}
          title="Removes a platform tile to create an impossible chasm"
        >
          {loading && lastAction === "CUT_BRIDGE" ? "Injecting..." : "✂ Cut Platform Bridge"}
        </button>
      </div>

      <div className="sabotage-note">
        ✦ <em>Judge action instantly breaks verified status $\to$ machine verifier detects failure $\to$ AI repairer synthesizes patch to restore playability.</em>
      </div>
    </div>
  );
};
