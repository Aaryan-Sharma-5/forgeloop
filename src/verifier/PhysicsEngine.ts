import type { Action, GameState, Level, PhysicsConfig } from "../types.js";

export interface Transition {
  nextState: GameState | null;
  collisionAt: { x: number; y: number } | null;
  reason: string | null;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  shortJumpDistance: 2,
  longJumpDistance: 4,
  jumpApexHeight: 1,
  gravityStep: 1,
};

/**
 * Deterministic discrete platformer model.
 *
 * There is intentionally no continuous physics, floating-point position,
 * frame integration, or external physics engine. Transitions are atomic
 * macro-actions with swept integer collision checking.
 */
export class PhysicsEngine {
  private readonly config: PhysicsConfig;

  constructor(
    private readonly level: Level,
    config?: Partial<PhysicsConfig>
  ) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
  }

  applyAction(state: GameState, action: Action): Transition {
    switch (action) {
      case "MOVE_LEFT":
        return this.move(state, -1);
      case "MOVE_RIGHT":
        return this.move(state, 1);
      case "WAIT":
        return this.wait(state);
      case "JUMP_SHORT":
        return this.jump(state, this.config.shortJumpDistance, "JUMP_SHORT");
      case "JUMP_LONG":
        return this.jump(state, this.config.longJumpDistance, "JUMP_LONG");
    }
  }

  private move(state: GameState, direction: -1 | 1): Transition {
    const nx = state.x + direction;
    const ny = state.y;

    if (!this.isInside(nx, ny)) {
      return this.collision(nx, ny, "Movement leaves level bounds");
    }

    if (!this.isWalkable(nx, ny)) {
      return this.collision(nx, ny, `Movement blocked by ${this.tileAt(nx, ny)}`);
    }

    const grounded = this.isGrounded(nx, ny);
    const nextY = grounded ? ny : this.applyDiscreteGravity(nx, ny);

    if (nextY === null) {
      return this.collision(nx, ny + 1, "Agent falls out of the level");
    }

    return {
      nextState: {
        x: nx,
        y: nextY,
        facing: direction,
        grounded: this.isGrounded(nx, nextY),
      },
      collisionAt: null,
      reason: null,
    };
  }

  private wait(state: GameState): Transition {
    if (state.grounded) {
      return {
        nextState: { ...state },
        collisionAt: null,
        reason: null,
      };
    }

    const nextY = this.applyDiscreteGravity(state.x, state.y);
    if (nextY === null) {
      return this.collision(state.x, state.y + 1, "Agent falls out of the level");
    }

    return {
      nextState: {
        x: state.x,
        y: nextY,
        facing: state.facing,
        grounded: this.isGrounded(state.x, nextY),
      },
      collisionAt: null,
      reason: null,
    };
  }

  private jump(
    state: GameState,
    distance: number,
    action: "JUMP_SHORT" | "JUMP_LONG"
  ): Transition {
    if (!state.grounded) {
      return this.collision(state.x, state.y, `${action} attempted while airborne`);
    }

    const sign = state.facing === -1 ? -1 : 1;
    const targetX = state.x + sign * distance;

    const arc = this.buildJumpArc(state.x, state.y, sign, distance);

    for (const point of arc) {
      if (!this.isInside(point.x, point.y)) {
        return this.collision(point.x, point.y, `${action} leaves level bounds`);
      }
      if (!this.isAirspace(point.x, point.y)) {
        return this.collision(
          point.x,
          point.y,
          `${action} trajectory collides with ${this.tileAt(point.x, point.y)}`
        );
      }
    }

    if (!this.isInside(targetX, state.y)) {
      return this.collision(targetX, state.y, `${action} lands outside level bounds`);
    }

    if (!this.isWalkable(targetX, state.y) || !this.isGrounded(targetX, state.y)) {
      return this.collision(targetX, state.y, `${action} has no valid landing platform`);
    }

    return {
      nextState: {
        x: targetX,
        y: state.y,
        facing: sign,
        grounded: true,
      },
      collisionAt: null,
      reason: null,
    };
  }

  private buildJumpArc(
    startX: number,
    startY: number,
    sign: -1 | 1,
    distance: number
  ): { x: number; y: number }[] {
    const apex = this.config.jumpApexHeight;
    if (distance === 2) {
      return [
        { x: startX + sign * 1, y: startY - apex },
        { x: startX + sign * 2, y: startY },
      ];
    }
    if (distance === 3) {
      return [
        { x: startX + sign * 1, y: startY - apex },
        { x: startX + sign * 2, y: startY - apex },
        { x: startX + sign * 3, y: startY },
      ];
    }
    if (distance === 4) {
      return [
        { x: startX + sign * 1, y: startY - apex },
        { x: startX + sign * 2, y: startY - (apex + 1) },
        { x: startX + sign * 3, y: startY - apex },
        { x: startX + sign * 4, y: startY },
      ];
    }

    // Dynamic fallback for any integer distance
    const arc: { x: number; y: number }[] = [];
    for (let step = 1; step <= distance; step++) {
      const p = step / distance;
      const dy = -Math.round(4 * apex * p * (1 - p));
      arc.push({ x: startX + sign * step, y: startY + dy });
    }
    return arc;
  }

  private applyDiscreteGravity(x: number, y: number): number | null {
    const below = y + this.config.gravityStep;
    if (!this.isInside(x, below)) {
      return null;
    }
    if (this.isSolid(x, below)) {
      return y;
    }
    return below;
  }

  private isGrounded(x: number, y: number): boolean {
    return this.isInside(x, y + 1) && this.isSolid(x, y + 1);
  }

  private isWalkable(x: number, y: number): boolean {
    return (
      this.isInside(x, y) &&
      !this.isSolid(x, y) &&
      this.tileAt(x, y) !== "HAZARD"
    );
  }

  private isAirspace(x: number, y: number): boolean {
    return (
      this.isInside(x, y) &&
      !this.isSolid(x, y) &&
      this.tileAt(x, y) !== "HAZARD"
    );
  }

  private isSolid(x: number, y: number): boolean {
    return this.tileAt(x, y) === "GROUND";
  }

  private tileAt(x: number, y: number) {
    return this.level.tiles[y]?.[x] ?? "AIR";
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.level.width && y < this.level.height;
  }

  private collision(x: number, y: number, reason: string): Transition {
    return {
      nextState: null,
      collisionAt: { x, y },
      reason,
    };
  }
}
