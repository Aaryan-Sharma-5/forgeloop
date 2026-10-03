import type { LevelSpec } from "../types.js";
import { validateLevelSpec, type SpecValidationResult } from "./schemas.js";
import {
  INTENT_COMPILER_SYSTEM_PROMPT,
  buildIntentCompilerPrompt,
  type IntentPromptOptions,
} from "./prompts.js";

/**
 * Isolated model interface for intent compilation.
 * Prevents tight coupling to external vendor SDK internals.
 */
export interface IntentCompilerModel {
  compileIntent(input: string, systemPrompt?: string): Promise<unknown>;
}

export interface IntentCompilationResult {
  rawOutput: unknown;
  spec?: LevelSpec | undefined;
  validation: SpecValidationResult;
}

/**
 * Options for configuring the Groq API model adapter.
 */
export interface GroqCompilerModelOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
}

/**
 * Factory for a Groq API model adapter using native fetch.
 * Does not require external SDK dependencies.
 */
export function createGroqCompilerModel(
  options: GroqCompilerModelOptions = {}
): IntentCompilerModel {
  const envKey =
    typeof globalThis !== "undefined" && (globalThis as any).process?.env?.GROQ_API_KEY
      ? ((globalThis as any).process.env.GROQ_API_KEY as string)
      : undefined;
  const apiKey = options.apiKey ?? envKey;
  const model = options.model ?? "llama-3.3-70b-versatile";
  const temperature = options.temperature ?? 0.1;
  const baseUrl = options.baseUrl ?? "https://api.groq.com/openai/v1/chat/completions";


  return {
    async compileIntent(input: string, systemPrompt?: string): Promise<unknown> {
      if (!apiKey) {
        throw new Error(
          "Groq API key is required. Set the GROQ_API_KEY environment variable or pass apiKey in options."
        );
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt ?? INTENT_COMPILER_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: input,
            },
          ],
          temperature,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API request failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Groq API returned empty response content");
      }

      return content;
    },
  };
}

/**
 * Deterministic built-in mock specs for testing, fallback demo paths,
 * and reliable offline execution.
 */
export const DEFAULT_MOCK_SPECS: Record<string, LevelSpec> = {
  easy: {
    width: 12,
    height: 8,
    platforms: [
      { x: 0, y: 6, w: 4, h: 2 },
      { x: 5, y: 6, w: 7, h: 2 },
    ],
    hazards: [{ x: 4, y: 7, w: 1, h: 1 }],
    start: { x: 1, y: 5 },
    goal: { x: 10, y: 5 },
    constraints: {
      required_jumps: 1,
      min_path_length: 3,
      target_difficulty: "EASY",
      no_trivial_route: true,
    },
  },
  medium: {
    width: 12,
    height: 8,
    platforms: [
      { x: 0, y: 6, w: 3, h: 2 },
      { x: 4, y: 6, w: 2, h: 2 },
      { x: 8, y: 6, w: 4, h: 2 },
    ],
    hazards: [
      { x: 3, y: 7, w: 1, h: 1 },
      { x: 6, y: 7, w: 2, h: 1 },
    ],
    start: { x: 0, y: 5 },
    goal: { x: 10, y: 5 },
    constraints: {
      required_jumps: 2,
      min_path_length: 3,
      target_difficulty: "MEDIUM",
      no_trivial_route: true,
    },
  },
  hard: {
    width: 16,
    height: 8,
    platforms: [
      { x: 0, y: 5, w: 2, h: 3 },
      { x: 3, y: 5, w: 1, h: 3 },
      { x: 7, y: 5, w: 1, h: 3 },
      { x: 9, y: 5, w: 1, h: 3 },
      { x: 13, y: 5, w: 3, h: 3 },
    ],
    hazards: [
      { x: 2, y: 7, w: 1, h: 1 },
      { x: 4, y: 7, w: 3, h: 1 },
      { x: 8, y: 7, w: 1, h: 1 },
      { x: 10, y: 7, w: 3, h: 1 },
    ],
    start: { x: 1, y: 4 },
    goal: { x: 13, y: 4 },
    constraints: {
      required_jumps: 4,
      min_path_length: 4,
      target_difficulty: "HARD",
      no_trivial_route: true,
    },
  },
};


/**
 * Creates an offline mock model adapter for deterministic testing and demo resilience.
 */
export function createMockCompilerModel(
  handlerOrDictionary?:
    | Record<string, LevelSpec>
    | ((intent: string) => LevelSpec | unknown)
): IntentCompilerModel {
  return {
    async compileIntent(input: string): Promise<unknown> {
      if (typeof handlerOrDictionary === "function") {
        return handlerOrDictionary(input);
      }

      const dict = { ...DEFAULT_MOCK_SPECS, ...handlerOrDictionary };
      const lower = input.toLowerCase();

      if (lower.includes("hard")) return dict.hard;
      if (lower.includes("medium")) return dict.medium;
      if (lower.includes("easy")) return dict.easy;

      // Default fallback
      return dict.easy;
    },
  };
}

export type { IntentPromptOptions } from "./prompts.js";

/**
 * Strips code fences or extracts outermost JSON object from a string.
 */
export function extractJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  // Strip ```json ... ```
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    const lastLine = lines[lines.length - 1];
    const endSlice = lastLine && lastLine.trim().startsWith("```") ? -1 : undefined;
    const inner = lines.slice(1, endSlice).join("\n");
    return JSON.parse(inner.trim());
  }


  // Attempt direct JSON parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // Attempt to locate outer { ... }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error("Unable to locate valid JSON object in string response");
  }
}

/**
 * IntentCompiler orchestrates prompt generation, model execution,
 * JSON extraction, and strict schema validation.
 */
export class IntentCompiler {
  constructor(private model: IntentCompilerModel) {}

  async compile(
    intent: string,
    options?: IntentPromptOptions
  ): Promise<IntentCompilationResult> {
    const userPrompt = buildIntentCompilerPrompt(intent, options);
    const raw = await this.model.compileIntent(userPrompt, INTENT_COMPILER_SYSTEM_PROMPT);

    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsed = extractJsonFromText(raw);
      } catch (err: any) {
        return {
          rawOutput: raw,
          validation: {
            valid: false,
            errors: [`Failed to extract parseable JSON: ${err.message}`],
          },
        };
      }
    }

    const validation = validateLevelSpec(parsed);
    return {
      rawOutput: raw,
      spec: validation.spec,
      validation,
    };
  }
}
