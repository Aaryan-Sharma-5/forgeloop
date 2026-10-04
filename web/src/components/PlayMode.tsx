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
    setStatusMessage("Active session. Use Arrow Keys/WASD or buttons below to step macro-actions.");
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
          if (isHazard(startX, curY + 1)) return curY + 1;
          curY++;
        }
        return curY;
      };

      const isAirspace = (x: number, y: number): boolean => {
        if (x < 0 || x >= level.width || y < 0 || y >= level.height) return false;
        const t = level.tiles[y]?.[x];
        return t !== "GROUND" && t !== "HAZARD";
      };

      const buildJumpArc = (
        startX: number,
        startY: number,
        facingSign: -1 | 1,
        distance: number
      ): { x: number; y: number }[] => {
        const apex = 1;
        if (distance === 2) {
          return [
            { x: startX + facingSign * 1, y: startY - apex },
            { x: startX + facingSign * 2, y: startY },
          ];
        }
        return [
          { x: startX + facingSign * 1, y: startY - apex },
          { x: startX + facingSign * 2, y: startY - (apex + 1) },
          { x: startX + facingSign * 3, y: startY - apex },
          { x: startX + facingSign * 4, y: startY },
        ];
      };

      if (action === "MOVE_LEFT" || action === "MOVE_RIGHT") {
        const targetX = player.x + sign;
        const targetY = player.y;

        if (isSolid(targetX, targetY)) {
          setStatusMessage(`BLOCKED: Solid wall at (${targetX}, ${targetY})`);
          return;
        }

        if (isHazard(targetX, targetY)) {
          setStatusMessage(`FATAL: Player touched lethal hazard at (${targetX}, ${targetY})! Resetting.`);
          handleStartPlay();
          return;
        }

        const landedY = applyGravity(targetX, targetY);
        if (landedY !== null) {
          nextX = targetX;
          nextY = landedY;
        }
      } else if (action === "JUMP_SHORT" || action === "JUMP_LONG") {
        const dist = action === "JUMP_SHORT" ? 2 : 4;
        const arc = buildJumpArc(player.x, player.y, sign, dist);

        let collision = false;
        for (const pt of arc) {
          if (!isAirspace(pt.x, pt.y)) {
            collision = true;
            break;
          }
        }

        if (collision) {
          setStatusMessage(`COLLISION: ${action} arc blocked by obstacle!`);
          return;
        }

        const landingCandidate = arc[arc.length - 1];
        if (landingCandidate) {
          const landedY = applyGravity(landingCandidate.x, landingCandidate.y);
          if (landedY !== null) {
            nextX = landingCandidate.x;
            nextY = landedY;
          }
        }
      }

      if (isHazard(nextX, nextY)) {
        setStatusMessage(`FATAL: Player fell into hazard at (${nextX}, ${nextY})! Resetting.`);
        handleStartPlay();
        return;
      }

      const updated: GameState = {
        x: nextX,
        y: nextY,
        grounded: true,
        facing: sign,
      };

      setPlayer(updated);
      setHistory((prev) => [...prev, action]);
      onPlayerStateChange?.(updated);

      if (level.tiles[nextY]?.[nextX] === "GOAL") {
        setStatusMessage(`GOAL REACHED in ${history.length + 1} steps! Verifier proof confirmed.`);
      } else {
        setStatusMessage(`Executed ${action} → Pos: (${nextX}, ${nextY})`);
      }
    },
    [isPlaying, player, level, history, onPlayerStateChange]
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-secondary)" }}>
            PLAY MODE // VERIFICATION GATE
          </span>
          <span className="badge badge-fail">LOCKED</span>
        </div>
        <div style={{
          padding: 12,
          background: "var(--bg-surface-elevated)",
          border: "1px solid var(--border-rule)",
          borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--ink-secondary)",
          lineHeight: 1.5,
        }}>
          Play Mode is restricted until the authoritative BFS verifier proves the level is playable (status: PASSED).
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--ink-secondary)" }}>
          PLAY MODE // CANONICAL PHYSICS
        </span>
        <span className="badge badge-pass">VERIFIED ACCESSIBLE</span>
      </div>

      {!isPlaying ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 11, color: "var(--ink-secondary)" }}>
            This level is mathematically verified solvable. Step in to execute player actions under canonical verifier physics:
          </p>
          <button className="btn btn-primary" onClick={handleStartPlay}>
            ENTER PLAY MODE
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            background: "var(--bg-surface-elevated)",
            border: "1px solid var(--border-rule)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}>
            <span>POS: ({player?.x}, {player?.y})</span>
            <span>GROUNDED: {player?.grounded ? "YES" : "NO"}</span>
            <span>STEPS: {history.length}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleStopPlay}>
              EXIT
            </button>
          </div>

          {statusMessage && (
            <div style={{
              padding: "6px 10px",
              background: "var(--bg-surface-inset)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-primary)",
            }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => stepAction("MOVE_LEFT")}>
              WALK LEFT [A]
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => stepAction("MOVE_RIGHT")}>
              WALK RIGHT [D]
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => stepAction("JUMP_SHORT")}>
              JUMP SHORT (2) [W]
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => stepAction("JUMP_LONG")}>
              JUMP LONG (4) [SPACE]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
