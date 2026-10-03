import React, { useEffect, useRef } from "react";
import type { Level, VerificationResult, LevelPatch, GameState } from "../types.ts";

export interface LevelCanvasProps {
  level: Level | null;
  verification?: VerificationResult | null;
  latestPatch?: LevelPatch | null;
  playerState?: GameState | null;
  onTileClick?: (x: number, y: number) => void;
  width?: number;
  height?: number;
}

export const LevelCanvas: React.FC<LevelCanvasProps> = ({
  level,
  verification,
  latestPatch,
  playerState,
  onTileClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !level) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridW = level.width;
    const gridH = level.height;

    // Calculate tile size to fit cleanly on screen (minimum 40px, maximum 64px)
    const tileSize = Math.min(60, Math.floor(Math.min(760 / gridW, 460 / gridH)));
    const canvasWidth = gridW * tileSize;
    const canvasHeight = gridH * tileSize;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. Background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. Render Tiles
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const tile = level.tiles[y]?.[x] ?? "AIR";
        const px = x * tileSize;
        const py = y * tileSize;

        // Grid lines
        ctx.strokeStyle = "#172033";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, tileSize, tileSize);

        if (tile === "GROUND") {
          // Platform block
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(px, py, tileSize, tileSize);

          // Glowing top edge
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(px, py, tileSize, Math.max(3, Math.floor(tileSize * 0.1)));

          // Inner bevel
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (tile === "HAZARD") {
          // Lethal hazard spikes
          ctx.fillStyle = "#450a0a";
          ctx.fillRect(px, py, tileSize, tileSize);

          // Draw neon hazard spikes
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          const spikeCount = 3;
          const spikeW = tileSize / spikeCount;
          for (let s = 0; s < spikeCount; s++) {
            ctx.moveTo(px + s * spikeW, py + tileSize);
            ctx.lineTo(px + (s + 0.5) * spikeW, py + tileSize * 0.35);
            ctx.lineTo(px + (s + 1) * spikeW, py + tileSize);
          }
          ctx.fill();

          ctx.strokeStyle = "#f87171";
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, tileSize, tileSize);
        } else if (tile === "START") {
          // Start portal
          ctx.fillStyle = "#052e16";
          ctx.fillRect(px, py, tileSize, tileSize);

          ctx.fillStyle = "#22c55e";
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.35, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.floor(tileSize * 0.38)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("S", px + tileSize / 2, py + tileSize / 2);
        } else if (tile === "GOAL") {
          // Goal beacon
          ctx.fillStyle = "#422006";
          ctx.fillRect(px, py, tileSize, tileSize);

          ctx.fillStyle = "#eab308";
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.35, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#000000";
          ctx.font = `bold ${Math.floor(tileSize * 0.38)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("G", px + tileSize / 2, py + tileSize / 2);
        }
      }
    }

    // 3. Highlight Patched Tiles (if any)
    if (latestPatch?.operations) {
      for (const op of latestPatch.operations) {
        const px = op.x * tileSize;
        const py = op.y * tileSize;
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

        // Indicator pulse
        ctx.fillStyle = "rgba(6, 182, 212, 0.25)";
        ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
      }
    }

    // 4. Counterexample Overlays
    if (verification?.status === "FAILED") {
      const ce = verification.counterexample;

      // Highlight Failure Node
      if (ce.failure_node) {
        const fnX = ce.failure_node.x * tileSize;
        const fnY = ce.failure_node.y * tileSize;

        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(fnX + 3, fnY + 3, tileSize - 6, tileSize - 6);
        ctx.setLineDash([]);

        // Label failure node
        ctx.fillStyle = "#f59e0b";
        ctx.font = `bold ${Math.floor(tileSize * 0.25)}px monospace`;
        ctx.textAlign = "left";
        ctx.fillText("FAIL", fnX + 4, fnY + 12);
      }

      // Highlight Collision Coordinate
      if (ce.collision_at) {
        const colX = ce.collision_at.x * tileSize;
        const colY = ce.collision_at.y * tileSize;

        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(colX + 4, colY + 4);
        ctx.lineTo(colX + tileSize - 4, colY + tileSize - 4);
        ctx.moveTo(colX + tileSize - 4, colY + 4);
        ctx.lineTo(colX + 4, colY + tileSize - 4);
        ctx.stroke();
      }

      // Draw vector to Goal if gap exists
      if (ce.failure_node && ce.gap_to_goal) {
        let goalX = -1;
        let goalY = -1;
        for (let y = 0; y < gridH; y++) {
          for (let x = 0; x < gridW; x++) {
            if (level.tiles[y]?.[x] === "GOAL") {
              goalX = x;
              goalY = y;
            }
          }
        }

        if (goalX !== -1) {
          const startPtX = (ce.failure_node.x + 0.5) * tileSize;
          const startPtY = (ce.failure_node.y + 0.5) * tileSize;
          const endPtX = (goalX + 0.5) * tileSize;
          const endPtY = (goalY + 0.5) * tileSize;

          ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(startPtX, startPtY);
          ctx.lineTo(endPtX, endPtY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 5. Render Play Mode Player Avatar
    if (playerState) {
      const px = (playerState.x + 0.5) * tileSize;
      const py = (playerState.y + 0.5) * tileSize;
      const radius = tileSize * 0.32;

      // Player circle
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eye / Facing direction indicator
      const eyeOffset = playerState.facing * radius * 0.4;
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.arc(px + eyeOffset, py - radius * 0.15, radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [level, verification, latestPatch, playerState]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!level || !onTileClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const tileSize = canvas.width / level.width;
    const tileX = Math.floor(clickX / tileSize);
    const tileY = Math.floor(clickY / tileSize);

    if (tileX >= 0 && tileX < level.width && tileY >= 0 && tileY < level.height) {
      onTileClick(tileX, tileY);
    }
  };

  if (!level) {
    return (
      <div className="canvas-placeholder">
        <div className="placeholder-icon">⬚</div>
        <p>No level loaded. Enter an intent above and click <strong>Synthesize & Verify</strong>.</p>
      </div>
    );
  }

  return (
    <div className="canvas-wrapper">
      <div className="canvas-header">
        <span className="dimension-badge">{level.width} × {level.height} Grid</span>
        <span className="legend-item"><span className="legend-color ground"></span> Ground</span>
        <span className="legend-item"><span className="legend-color hazard"></span> Hazard</span>
        <span className="legend-item"><span className="legend-color start"></span> Start</span>
        <span className="legend-item"><span className="legend-color goal"></span> Goal</span>
        {latestPatch?.operations && latestPatch.operations.length > 0 && (
          <span className="patch-highlight-badge">✦ {latestPatch.operations.length} Patched Tile(s)</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="level-canvas"
        title="Click on any tile to inspect or target with Judge Sabotage"
      />
    </div>
  );
};
