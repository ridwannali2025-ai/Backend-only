export interface SafetyDecision {
  allowed: boolean;
  reason?: string;
  ui?: {
    title: string;
    message: string;
    code: string;
  };
}

export const SAFETY_LIMITS = {
  maxCalorieDeficitPerDay: 1000,
  maxWeeklyVolumeIncreasePct: 0.2,
} as const;

const EATING_DISORDER_PATTERNS = [
  /anorex/i,
  /bulimi/i,
  /binge\s*eat/i,
  /purge/i,
  /self[-\s]*harm/i,
  /suicid/i,
  /laxative/i,
  /vomit/i,
  /starv/i,
  /eating\s*disorder/i,
];

const MEDICAL_ADVICE_PATTERNS = [
  /medical\s*advice/i,
  /diagnos/i,
  /prescrib/i,
  /medication/i,
  /surgery/i,
  /treat/i,
  /rehab/i,
  /physical\s*therapy/i,
  /injury\s*advice/i,
];

// Prohibited domains: weapons, explosives, illegal activities
const PROHIBITED_DOMAIN_PATTERNS = [
  /\b(bomb|explosive|dynamite|grenade|detonat|incendiary|molotov|pipe\s*bomb|improvised\s*explosive)\b/i,
  /\b(weapon|gun|firearm|rifle|pistol|ammunition|bullet|ammo)\b/i,
  /\b(hack|hacking|cyber\s*attack|ddos|malware|virus|trojan)\b/i,
  /\b(poison|toxic\s*substance|chemical\s*weapon)\b/i,
  /\b(illegal\s*drug|manufactur.*drug|synthesiz.*drug)\b/i,
];

// Instructional intent patterns: requests for procedures/instructions
const INSTRUCTIONAL_INTENT_PATTERNS = [
  /\b(how\s*to|step\s*by\s*step|instructions?|guide|tutorial|recipe\s*for|make\s*a|build\s*a|create\s*a|construct\s*a)\b/i,
  /\b(teach\s*me|show\s*me|explain\s*how|walk\s*me\s*through)\b/i,
];

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, acc));
    return acc;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, acc));
  }

  return acc;
}

function collectNumbersByKey(
  value: unknown,
  predicate: (key: string) => boolean,
  acc: number[] = []
): number[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNumbersByKey(item, predicate, acc));
    return acc;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (predicate(key) && typeof val === "number" && Number.isFinite(val)) {
        acc.push(val);
      }
      collectNumbersByKey(val, predicate, acc);
    });
  }

  return acc;
}

function findFirstNumberByKeys(value: unknown, keys: string[]): number | null {
  const normalized = keys.map((key) => key.toLowerCase());
  const found = collectNumbersByKey(value, (key) => normalized.includes(key.toLowerCase()));
  return found.length > 0 ? found[0] : null;
}

function hasPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value > 1 ? value / 100 : value;
}

function exceedsCalorieDeficit(body: unknown): boolean {
  const deficitValues = collectNumbersByKey(body, (key) => {
    const normalized = key.toLowerCase();
    return normalized.includes("calorie") && normalized.includes("deficit");
  });

  if (deficitValues.some((value) => value > SAFETY_LIMITS.maxCalorieDeficitPerDay)) {
    return true;
  }

  const caloriesPerDay = findFirstNumberByKeys(body, [
    "caloriesPerDay",
    "calories_per_day",
    "dailyCalories",
    "daily_calories",
  ]);
  const maintenanceCalories = findFirstNumberByKeys(body, [
    "maintenanceCalories",
    "maintenance_calories",
    "tdee",
    "caloriesMaintenance",
  ]);

  if (caloriesPerDay !== null && maintenanceCalories !== null) {
    const deficit = maintenanceCalories - caloriesPerDay;
    return deficit > SAFETY_LIMITS.maxCalorieDeficitPerDay;
  }

  return false;
}

function exceedsWeeklyVolumeIncrease(body: unknown): boolean {
  const volumeValues = collectNumbersByKey(body, (key) => {
    const normalized = key.toLowerCase();
    return normalized.includes("volume") && normalized.includes("increase");
  });

  return volumeValues.some(
    (value) => normalizePercent(value) > SAFETY_LIMITS.maxWeeklyVolumeIncreasePct
  );
}

export function evaluateSafety(input: {
  route: string;
  taskType: string;
  body: unknown;
}): SafetyDecision {
  const text = collectStrings(input.body).join(" ");

  if (hasPattern(text, EATING_DISORDER_PATTERNS)) {
    return {
      allowed: false,
      reason: "Eating disorder patterns detected",
      ui: {
        title: "Safety Concern",
        message: "I can't help with requests that involve eating disorder behaviors. If you need support, please reach out to a qualified professional.",
        code: "safety_eating_disorder",
      },
    };
  }

  if (hasPattern(text, MEDICAL_ADVICE_PATTERNS)) {
    return {
      allowed: false,
      reason: "Medical advice patterns detected",
      ui: {
        title: "Safety Concern",
        message: "I can't provide medical or injury advice. Please consult a licensed healthcare professional.",
        code: "safety_medical_advice",
      },
    };
  }

  if (exceedsCalorieDeficit(input.body)) {
    return {
      allowed: false,
      reason: "Calorie deficit exceeds safety limit",
      ui: {
        title: "Safety Concern",
        message: "For your safety, I can't help with a calorie deficit above 1000 calories per day. Please consult a qualified professional for guidance.",
        code: "safety_calorie_deficit",
      },
    };
  }

  if (exceedsWeeklyVolumeIncrease(input.body)) {
    return {
      allowed: false,
      reason: "Training volume increase exceeds safety limit",
      ui: {
        title: "Safety Concern",
        message: "For your safety, I can't help with increasing weekly training volume by more than 20%. Please consult a qualified professional for guidance.",
        code: "safety_volume_increase",
      },
    };
  }

  // Semantic safety check: block only when BOTH prohibited domain AND instructional intent are present
  const hasProhibitedDomain = hasPattern(text, PROHIBITED_DOMAIN_PATTERNS);
  const hasInstructionalIntent = hasPattern(text, INSTRUCTIONAL_INTENT_PATTERNS);

  // Allow cooking/food-related content even if it has instructional intent
  const isCookingContext = /\b(cook|recipe|food|meal|ingredient|kitchen|culinary|bake|roast|grill|fry|boil|steam)\b/i.test(text);

  if (hasProhibitedDomain && hasInstructionalIntent && !isCookingContext) {
    return {
      allowed: false,
      reason: "Prohibited content with instructional intent detected",
      ui: {
        title: "Content Not Allowed",
        message: "I can't provide instructions for creating weapons, explosives, or other harmful content. If you need help with something else, I'm here to assist.",
        code: "safety_prohibited_content",
      },
    };
  }

  return { allowed: true };
}
