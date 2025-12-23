export type SafetyDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

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
      code: "safety_eating_disorder",
      message:
        "Sorry, I can't help with requests that involve eating disorder behaviors. If you need support, please reach out to a qualified professional.",
    };
  }

  if (hasPattern(text, MEDICAL_ADVICE_PATTERNS)) {
    return {
      allowed: false,
      code: "safety_medical_advice",
      message:
        "Sorry, I can't provide medical or injury advice. Please consult a licensed clinician.",
    };
  }

  if (exceedsCalorieDeficit(input.body)) {
    return {
      allowed: false,
      code: "safety_calorie_deficit",
      message:
        "For safety, I can't help with a calorie deficit above 1000 calories per day.",
    };
  }

  if (exceedsWeeklyVolumeIncrease(input.body)) {
    return {
      allowed: false,
      code: "safety_volume_increase",
      message:
        "For safety, I can't help with increasing weekly training volume by more than 20%.",
    };
  }

  return { allowed: true };
}
