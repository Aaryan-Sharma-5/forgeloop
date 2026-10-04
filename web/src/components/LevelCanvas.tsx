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

const RULER_OFFSET = 22; // Pixels reserved for X and Y coordinate axis rulers

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

    // Calculate tile size to fit cleanly on screen (minimum 40px, maximum 60px)
    const tileSize = Math.min(56, Math.floor(Math.min(740 / gridW, 440 / gridH)));
    const gridPxW = gridW * tileSize;
    const gridPxH = gridH * tileSize;
    const canvasWidth = gridPxW + RULER_OFFSET;
    const canvasHeight = gridPxH + RULER_OFFSET;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. Technical Drafting Canvas Background
    ctx.fillStyle = "#111620";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Coordinate Rulers Background
    ctx.fillStyle = "#0A0E15";
    ctx.fillRect(0, 0, canvasWidth, RULER_OFFSET);
    ctx.fillRect(0, 0, RULER_OFFSET, canvasHeight);

    // Ruler Divider Lines
    ctx.strokeStyle = "#273142";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(RULER_OFFSET, 0);
    ctx.lineTo(RULER_OFFSET, canvasHeight);
    ctx.moveTo(0, RULER_OFFSET);
    ctx.lineTo(canvasWidth, RULER_OFFSET);
    ctx.stroke();

    // Corner Origin Tag
    ctx.fillStyle = "#4B5565";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("0,0", RULER_OFFSET / 2, RULER_OFFSET / 2);

    // X-Axis Coordinate Markers
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let x = 0; x < gridW; x++) {
      const px = RULER_OFFSET + x * tileSize + tileSize / 2;
      ctx.fillStyle = "#6B7A90";
      ctx.fillText(x.toString(), px, RULER_OFFSET / 2);

      // Tick mark
      ctx.strokeStyle = "#273142";
      ctx.beginPath();
      ctx.moveTo(RULER_OFFSET + (x + 1) * tileSize, RULER_OFFSET - 4);
      ctx.lineTo(RULER_OFFSET + (x + 1) * tileSize, RULER_OFFSET);
      ctx.stroke();
    }

    // Y-Axis Coordinate Markers
    for (let y = 0; y < gridH; y++) {
      const py = RULER_OFFSET + y * tileSize + tileSize / 2;
      ctx.fillStyle = "#6B7A90";
      ctx.fillText(y.toString(), RULER_OFFSET / 2, py);

      // Tick mark
      ctx.strokeStyle = "#273142";
      ctx.beginPath();
      ctx.moveTo(RULER_OFFSET - 4, RULER_OFFSET + (y + 1) * tileSize);
      ctx.lineTo(RULER_OFFSET, RULER_OFFSET + (y + 1) * tileSize);
      ctx.stroke();
    }

    // 2. Render Blueprint Grid & Tiles
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const tile = level.tiles[y]?.[x] ?? "AIR";
        const px = RULER_OFFSET + x * tileSize;
        const py = RULER_OFFSET + y * tileSize;

        // Blueprint 1px Grid Outline
        ctx.strokeStyle = "#1A2230";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, tileSize, tileSize);

        if (tile === "GROUND") {
          // Architectural Ground Block
          ctx.fillStyle = "#1E2736";
          ctx.fillRect(px, py, tileSize, tileSize);

          // Top walking rail
          ctx.fillStyle = "#365985";
          ctx.fillRect(px, py, tileSize, 3);

          // Technical inner hatching line
          ctx.strokeStyle = "#2B374A";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 4, py + tileSize - 4);
          ctx.lineTo(px + tileSize - 4, py + 4);
          ctx.stroke();
        } else if (tile === "HAZARD") {
          // Industrial Caution Hazard (Spikes & diagonal stripes)
          ctx.fillStyle = "#2D1414";
          ctx.fillRect(px, py, tileSize, tileSize);

          // Industrial warning stripes
          ctx.save();
          ctx.beginPath();
          ctx.rect(px, py, tileSize, tileSize);
          ctx.clip();
          ctx.strokeStyle = "#8A2424";
          ctx.lineWidth = 4;
          for (let s = -tileSize; s < tileSize * 2; s += 8) {
            ctx.beginPath();
            ctx.moveTo(px + s, py);
            ctx.lineTo(px + s + tileSize, py + tileSize);
            ctx.stroke();
          }
          ctx.restore();

          // Hazard border
          ctx.strokeStyle = "#A52828";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (tile === "START") {
          // Precision Start Point
          ctx.fillStyle = "#11261B";
          ctx.fillRect(px, py, tileSize, tileSize);

          // Crosshair circle
          ctx.strokeStyle = "#1B6535";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.32, 0, Math.PI * 2);
          ctx.stroke();

          // S Badge
          ctx.fillStyle = "#268E4C";
          ctx.font = `bold ${Math.floor(tileSize * 0.35)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("S", px + tileSize / 2, py + tileSize / 2);
        } else if (tile === "GOAL") {
          // Precision Goal Point
          ctx.fillStyle = "#281D0E";
          ctx.fillRect(px, py, tileSize, tileSize);

          // Target square
          ctx.strokeStyle = "#B07219";
          ctx.lineWidth = 2;
          ctx.strokeRect(px + tileSize * 0.2, py + tileSize * 0.2, tileSize * 0.6, tileSize * 0.6);

          // G Badge
          ctx.fillStyle = "#D48B22";
          ctx.font = `bold ${Math.floor(tileSize * 0.35)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("G", px + tileSize / 2, py + tileSize / 2);
        }
      }
    }

    // 3. Technical Patch Diff Overlay (if any patch applied)
    if (latestPatch?.operations) {
      for (const op of latestPatch.operations) {
        const px = RULER_OFFSET + op.x * tileSize;
        const py = RULER_OFFSET + op.y * tileSize;

        ctx.strokeStyle = "#B07219";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.setLineDash([]);

        // Small tag
        ctx.fillStyle = "#B07219";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("PATCH", px + 3, py + 3);
      }
    }

    // 4. Authoritative Verification Overlays (Failures & Telemetry)
    if (verification?.status === "FAILED") {
      const ce = verification.counterexample;

      // Failure Node Target Reticle
      if (ce.failure_node) {
        const fnX = RULER_OFFSET + ce.failure_node.x * tileSize;
        const fnY = RULER_OFFSET + ce.failure_node.y * tileSize;

        ctx.strokeStyle = "#B07219";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(fnX + 2, fnY + 2, tileSize - 4, tileSize - 4);
        ctx.setLineDash([]);

        ctx.fillStyle = "#B07219";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("FAIL", fnX + 4, fnY + 4);
      }

      // Exact Collision Crosshair
      if (ce.collision_at) {
        const colX = RULER_OFFSET + ce.collision_at.x * tileSize;
        const colY = RULER_OFFSET + ce.collision_at.y * tileSize;

        ctx.strokeStyle = "#A52828";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(colX + 5, colY + 5);
        ctx.lineTo(colX + tileSize - 5, colY + tileSize - 5);
        ctx.moveTo(colX + tileSize - 5, colY + 5);
        ctx.lineTo(colX + 5, colY + tileSize - 5);
        ctx.stroke();

        ctx.fillStyle = "#A52828";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText("COLLISION", colX + 4, colY + tileSize - 2);
      }

      // Gap Vector to Goal (Engineering dashed vector)
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
          const startPtX = RULER_OFFSET + (ce.failure_node.x + 0.5) * tileSize;
          const startPtY = RULER_OFFSET + (ce.failure_node.y + 0.5) * tileSize;
          const endPtX = RULER_OFFSET + (goalX + 0.5) * tileSize;
          const endPtY = RULER_OFFSET + (goalY + 0.5) * tileSize;

          ctx.strokeStyle = "rgba(176, 114, 25, 0.75)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(startPtX, startPtY);
          ctx.lineTo(endPtX, endPtY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // 5. Play Mode Avatar (Crisp Mechanical Cursor)
    if (playerState) {
      const px = RULER_OFFSET + (playerState.x + 0.5) * tileSize;
      const py = RULER_OFFSET + (playerState.y + 0.5) * tileSize;
      const radius = tileSize * 0.32;

      ctx.fillStyle = "#2D68C4";
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#FAF9F5";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Heading indicator mark
      const eyeOffset = playerState.facing * radius * 0.45;
      ctx.fillStyle = "#FAF9F5";
      ctx.beginPath();
      ctx.arc(px + eyeOffset, py - radius * 0.15, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [level, verification, latestPatch, playerState]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!level || !onTileClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - RULER_OFFSET;
    const clickY = e.clientY - rect.top - RULER_OFFSET;

    if (clickX < 0 || clickY < 0) return;

    const tileSize = (canvas.width - RULER_OFFSET) / level.width;
    const tileX = Math.floor(clickX / tileSize);
    const tileY = Math.floor(clickY / tileSize);

    if (tileX >= 0 && tileX < level.width && tileY >= 0 && tileY < level.height) {
      onTileClick(tileX, tileY);
    }
  };

  if (!level) {
    return (
      <div className="canvas-placeholder">
        <p>No level loaded. Enter an intent above and click <strong>Compile & Verify</strong>.</p>
      </div>
    );
  }

  return (
    <div className="canvas-wrapper">
      <div className="canvas-header">
        <span className="dimension-badge">{level.width} × {level.height} GRID</span>
        <span className="legend-item"><span className="legend-color ground"></span> GROUND</span>
        <span className="legend-item"><span className="legend-color hazard"></span> HAZARD</span>
        <span className="legend-item"><span className="legend-color start"></span> START</span>
        <span className="legend-item"><span className="legend-color goal"></span> GOAL</span>
        {latestPatch?.operations && latestPatch.operations.length > 0 && (
          <span className="patch-highlight-badge">PATCH: {latestPatch.operations.length} OPS</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="level-canvas"
        title="Engineering coordinate plane. Click tile to inspect or target with Judge Sabotage."
      />
    </div>
  );
};
