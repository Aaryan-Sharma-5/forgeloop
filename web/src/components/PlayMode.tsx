import React, { useState, useEffect, useCallback } from "react";
import type { Level, GameState, Action } from "../types.ts";

export interface PlayModeProps {
  level: Level;
  isVerifiedPlayable: boolean;
  onPlayerStateChange?: (state: GameState | null) => void;
}

export const PlayMode: React.FC<PlayModeProps> = ({
  level,
  isVerifiedPlayable,
  onPlayerStateChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [player, setPlayer] = useState<GameState | null>(null);
  const [history, setHistory] = useState<Action[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Locate START tile
  const getStartPos = useCallback((): { x: number; y: number } => {
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.tiles[y]?.[x] === "START") {
          return { x, y };
        }
      }
    }
    return { x: 0, y: 0 };
  }, [level]);

  // Start / Reset game
  const handleStartPlay = () => {
    const start = getStartPos();
    const initial: GameState = {
      x: start.x,
      y: start.y,
      grounded: true,
      facing: 1,
    };
    setPlayer(initial);
    setIsPlaying(true);
    setHistory([]);
    setStatusMessage("Use Arrow Keys or buttons below to step macro-actions!");
    onPlayerStateChange?.(initial);
  };

  const handleStopPlay = () => {
    setIsPlaying(false);
    setPlayer(null);
    setStatusMessage(null);
    onPlayerStateChange?.(null);
  };

  // Canonical discrete physics transition matching PhysicsEngine
  const stepAction = useCallback(
    (action: Action) => {
      if (!isPlaying || !player) return;

      const sign = action === "MOVE_LEFT" ? -1 : action === "MOVE_RIGHT" ? 1 : player.facing;
      let nextX = player.x;
      let nextY = player.y;

      const isSolid = (x: number, y: number) => {
        if (x < 0 || x >= level.width || y < 0 || y >= level.height) return true;
        return level.tiles[y]?.[x] === "GROUND";
      };

      const isHazard = (x: number, y: number) => {
        if (x < 0 || x >= level.width || y < 0 || y >= level.height) return false;
        return level.tiles[y]?.[x] === "HAZARD";
      };

      const applyGravity = (startX: number, startY: number): number | null => {
        let curY = startY;
        while (curY < level.height - 1) {
          if (isSolid(startX, curY + 1)) return curY;
          if (isHazard(startX, curY + 1)) return curY + 1; // Fell into hazard
          curY++;
        }
        return curY;
      };

      if (action === "MOVE_LEFT" || action === "MOVE_RIGHT") {
        const targetX = player.x + sign;
        if (targetX >= 0 && targetX < level.width && !isSolid(targetX, player.y)) {
          nextX = targetX;
          const landY = applyGravity(nextX, nextY);
          if (landY !== null) {
            nextY = landY;
          }
        }
      } else if (action === "JUMP_SHORT") {
        const distance = 2;
        const targetX = player.x + sign * distance;
        if (targetX >= 0 && targetX < level.width && !isSolid(targetX, player.y)) {
          nextX = targetX;
          const landY = applyGravity(nextX, nextY);
          if (landY !== null) {
            nextY = landY;
          }
        }
      } else if (action === "JUMP_LONG") {
        const distance = 4;
        const targetX = player.x + sign * distance;
        if (targetX >= 0 && targetX < level.width && !isSolid(targetX, player.y)) {
          nextX = targetX;
          const landY = applyGravity(nextX, nextY);
          if (landY !== null) {
            nextY = landY;
          }
        }
      }

      // Check Hazard Collision
      if (isHazard(nextX, nextY)) {
        setStatusMessage("💀 Hazard contact! Resetting to START position...");
        const start = getStartPos();
        const resetState: GameState = { x: start.x, y: start.y, grounded: true, facing: 1 };
        setPlayer(resetState);
        onPlayerStateChange?.(resetState);
        return;
      }

      // Check Goal Reached
      if (level.tiles[nextY]?.[nextX] === "GOAL") {
        setStatusMessage("🎉 GOAL REACHED! Verified level solved interactively!");
      }

      const updated: GameState = {
        x: nextX,
        y: nextY,
        grounded: isSolid(nextX, nextY + 1),
        facing: sign,
      };

      setPlayer(updated);
      setHistory((prev) => [...prev, action]);
      onPlayerStateChange?.(updated);
    },
    [isPlaying, player, level, getStartPos, onPlayerStateChange]
  );

  // Keyboard controls listener
  useEffect(() => {
    if (!isPlaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        stepAction("MOVE_LEFT");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        stepAction("MOVE_RIGHT");
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (e.shiftKey) {
          stepAction("JUMP_LONG");
        } else {
          stepAction("JUMP_SHORT");
        }
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        stepAction("JUMP_LONG");
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        stepAction("WAIT");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, stepAction]);

  if (!isVerifiedPlayable) {
    return (
      <div className="panel playmode-panel locked">
        <div className="panel-title">Interactive Play Mode</div>
        <div className="locked-notice">
          🔒 Locked. Play mode is only enabled after machine verification confirms <strong>PASSED</strong> playability.
        </div>
      </div>
    );
  }

  return (
    <div className="panel playmode-panel">
      <div className="panel-header">
        <div className="panel-title">Interactive Play Mode (Verified Engine)</div>
        <span className="unlocked-badge">✔ Playable</span>
      </div>

      {!isPlaying ? (
        <div className="play-prompt">
          <p>This level has been mathematically verified solvable. Step in and play:</p>
          <button className="btn btn-success" onClick={handleStartPlay}>
            ▶ Start Play Mode
          </button>
        </div>
      ) : (
        <div className="active-play-controls">
          <div className="hud-bar">
            <span>Position: ({player?.x}, {player?.y})</span>
            <span>Grounded: {player?.grounded ? "YES" : "NO"}</span>
            <span>Steps: {history.length}</span>
            <button className="btn btn-outline-sm" onClick={handleStopPlay}>
              ⏹ Exit
            </button>
          </div>

          {statusMessage && <div className="play-status-banner">{statusMessage}</div>}

          <div className="action-buttons-hud">
            <button className="btn btn-hud" onClick={() => stepAction("MOVE_LEFT")}>
              ◀ Walk Left [A]
            </button>
            <button className="btn btn-hud primary" onClick={() => stepAction("JUMP_SHORT")}>
              ▲ Jump Short (2) [W]
            </button>
            <button className="btn btn-hud warning" onClick={() => stepAction("JUMP_LONG")}>
              ⮉ Jump Long (4) [Space]
            </button>
            <button className="btn btn-hud" onClick={() => stepAction("MOVE_RIGHT")}>
              Walk Right [D] ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
