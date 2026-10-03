export * from "./types.js";
export { PhysicsEngine, DEFAULT_PHYSICS_CONFIG } from "./verifier/PhysicsEngine.js";
export { BFSVerifier } from "./verifier/BFSVerifier.js";
export { validateLevelStructure, compileLevelSpec } from "./shared/validation.js";
export {
  validatePatch,
  applyPatch,
  computePatch,
  DEFAULT_MAX_PATCH_OPERATIONS,
} from "./verifier/patches.js";
export * as fixtures from "./verifier/fixtures.js";

import { BFSVerifier } from "./verifier/BFSVerifier.js";
import type { Level, PhysicsConfig } from "./types.js";

export function verifyLevel(level: Level, config?: Partial<PhysicsConfig>) {
  return new BFSVerifier(config).verify(level);
}
