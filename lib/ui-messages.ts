// Backend-only lib/ui-messages.ts
// User-facing messages for all guardrails and errors

export type UIMessageCode =
  | "bad_request"
  | "method_not_allowed"
  | "payload_too_large"
  | "rate_limited_chat"
  | "rate_limited_action"
  | "ai_unavailable"
  | "safety_injury"
  | "safety_aggressive_cut"
  | "regen_coaching"
  | "server_error";

export interface UIMessage {
  title: string;
  message: string;
}

/**
 * Get user-facing message for a given code
 */
export function getUIMessage(code: UIMessageCode): UIMessage {
  switch (code) {
    case "bad_request":
      return {
        title: "Invalid Request",
        message: "Please check your request and try again.",
      };
    case "method_not_allowed":
      return {
        title: "Method Not Allowed",
        message: "This endpoint only accepts POST requests.",
      };
    case "payload_too_large":
      return {
        title: "Request Too Large",
        message: "Your request is too large. Please reduce the size and try again.",
      };
    case "rate_limited_chat":
      return {
        title: "Too Many Messages",
        message: "You're sending messages too quickly. Please slow down and try again in a moment.",
      };
    case "rate_limited_action":
      return {
        title: "Rate Limit Exceeded",
        message: "You've reached your limit for this action. Please try again later.",
      };
    case "ai_unavailable":
      return {
        title: "Service Unavailable",
        message: "AI features are temporarily unavailable. Please try again later.",
      };
    case "safety_injury":
      return {
        title: "Safety Concern",
        message: "I can't provide medical or injury advice. Please consult a licensed healthcare professional.",
      };
    case "safety_aggressive_cut":
      return {
        title: "Safety Concern",
        message: "For your safety, I can't help with requests that involve extreme changes. Please consult a qualified professional for guidance.",
      };
    case "regen_coaching":
      return {
        title: "Too Many Changes",
        message: "We've made a lot of changes already. Constantly switching programs won't help your progress — consistency is how results happen. Let's commit to this plan for a bit and reassess soon.",
      };
    case "server_error":
      return {
        title: "Something Went Wrong",
        message: "An unexpected error occurred. Please try again later.",
      };
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = code;
      return {
        title: "Error",
        message: "An error occurred. Please try again.",
      };
  }
}

/**
 * Map safety guardrail code to UI message code
 */
export function mapSafetyCodeToUIMessageCode(safetyCode: string): UIMessageCode {
  if (safetyCode === "safety_medical_advice") {
    return "safety_injury";
  }
  if (
    safetyCode === "safety_eating_disorder" ||
    safetyCode === "safety_calorie_deficit" ||
    safetyCode === "safety_volume_increase"
  ) {
    return "safety_aggressive_cut";
  }
  // Default fallback
  return "safety_aggressive_cut";
}

