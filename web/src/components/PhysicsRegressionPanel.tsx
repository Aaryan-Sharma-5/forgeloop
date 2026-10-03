import React, { useState } from "react";
import type { PhysicsConfig } from "../types.ts";

export interface PhysicsRegressionPanelProps {
  onRegressPhysics: (config: Partial<PhysicsConfig>) => Promise<void>;
  disabled?: boolean;
}

export const PhysicsRegressionPanel: React.FC<PhysicsRegressionPanelProps> = ({
  onRegressPhysics,
  disabled,
}) => {
  const [shortJump, setShortJump] = useState(2);
  const [longJump, setLongJump] = useState(4);
  const [gravity, setGravity] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    try {
      setLoading(true);
      await onRegressPhysics({
        shortJumpDistance: shortJump,
        longJumpDistance: longJump,
        gravityStep: gravity,
      });
    } catch (err: any) {
      alert(`Physics regression failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetNerf = async () => {
    setLongJump(3); // Nerf long jump from 4 to 3
    try {
      setLoading(true);
      await onRegressPhysics({
        shortJumpDistance: shortJump,
        longJumpDistance: 3,
        gravityStep: gravity,
      });
    } catch (err: any) {
      alert(`Physics regression failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetStandard = async () => {
    setShortJump(2);
    setLongJump(4);
    setGravity(1);
    try {
      setLoading(true);
      await onRegressPhysics({
        shortJumpDistance: 2,
        longJumpDistance: 4,
        gravityStep: 1,
      });
    } catch (err: any) {
      alert(`Physics regression failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel physics-panel">
      <div className="panel-header">
        <div className="panel-title">Parametric Rules-Change Regression</div>
        <span className="physics-badge">Game Tech CI/CD</span>
      </div>

      <p className="panel-desc">
        Test automated regression by nerfing engine physics to verify if previously published levels break:
      </p>

      <div className="sliders-grid">
        <div className="slider-group">
          <label>
            Short Jump Distance: <strong>{shortJump} tiles</strong>
          </label>
          <input
            type="range"
            min={1}
            max={3}
            value={shortJump}
            disabled={disabled || loading}
            onChange={(e) => setShortJump(Number(e.target.value))}
          />
        </div>

        <div className="slider-group">
          <label>
            Long Jump Distance: <strong>{longJump} tiles</strong>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={longJump}
            disabled={disabled || loading}
            onChange={(e) => setLongJump(Number(e.target.value))}
          />
        </div>

        <div className="slider-group">
          <label>
            Gravity Step: <strong>{gravity} tile/step</strong>
          </label>
          <input
            type="range"
            min={1}
            max={2}
            value={gravity}
            disabled={disabled || loading}
            onChange={(e) => setGravity(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="physics-buttons">
        <button
          className="btn btn-secondary"
          onClick={handleApply}
          disabled={disabled || loading}
        >
          {loading ? "Re-verifying..." : "Apply Custom Rules"}
        </button>

        <button
          className="btn btn-warning"
          onClick={handlePresetNerf}
          disabled={disabled || loading}
          title="Simulates balance patch nerfing Long Jump distance from 4 to 3"
        >
          Nerf Jump (4 → 3)
        </button>

        <button
          className="btn btn-outline"
          onClick={handleResetStandard}
          disabled={disabled || loading}
        >
          Reset Standard
        </button>
      </div>
    </div>
  );
};
