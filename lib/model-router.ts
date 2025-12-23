import { env } from "./env";
import { ROUTE_GUARDRAILS } from "./route-guardrails";

export type ModelTier = "brain" | "planner" | "mouth" | "analyst";

export type TaskType =
  | "generate_program"
  | "generate_meal_plan"
  | "weekly_checkin"
  | "chat"
  | "analyze_progress";

const MIN_OUTPUT_TOKENS = 256;
const MAX_OUTPUT_TOKENS = 4096;

function clampTokens(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_OUTPUT_TOKENS;
  }
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, Math.floor(value)));
}

export function selectModel({
  route,
  taskType,
  tier,
}: {
  route: string;
  taskType: TaskType;
  tier: ModelTier;
}): {
  modelUsed: string;
  fallbackModel: string;
  maxOutputTokens: number;
} {
  const modelByTier: Record<ModelTier, string> = {
    brain: env.MODEL_BRAIN ?? "gpt-5",
    planner: env.MODEL_PLANNER ?? "gpt-5-mini",
    mouth: env.MODEL_MOUTH ?? "gpt-5-mini",
    analyst: env.MODEL_ANALYST ?? "gpt-5-mini",
  };

  const fallbackModel = env.MODEL_FALLBACK ?? "gpt-5-mini";
  const routeMax =
    ROUTE_GUARDRAILS[route as keyof typeof ROUTE_GUARDRAILS]?.maxOutputTokens ??
    MIN_OUTPUT_TOKENS;

  return {
    modelUsed: modelByTier[tier],
    fallbackModel,
    maxOutputTokens: clampTokens(routeMax),
  };
}
