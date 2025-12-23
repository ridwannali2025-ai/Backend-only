import { createAnonSupabaseClient, getBearerToken, getUserIdFromRequest, safeSelect } from "./supabase";

export type LoadedContext = {
  user_id: string | null;
  profile: Record<string, unknown> | null;
  active_program: Record<string, unknown> | null;
  workouts_14d: { sessions: Array<Record<string, unknown>>; sets: Array<Record<string, unknown>> };
  meals_7d: Array<Record<string, unknown>>;
  weight_30d: Array<Record<string, unknown>>;
};

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function loadContext({
  req,
  route,
}: {
  req: Request;
  route: string;
}): Promise<LoadedContext> {
  const userId = getUserIdFromRequest(req);
  const accessToken = getBearerToken(req) ?? undefined;
  const supabase = createAnonSupabaseClient(accessToken);

  const emptyContext: LoadedContext = {
    user_id: userId,
    profile: null,
    active_program: null,
    workouts_14d: { sessions: [], sets: [] },
    meals_7d: [],
    weight_30d: [],
  };

  if (!userId || !supabase) {
    return emptyContext;
  }

  const since14d = isoDaysAgo(14);
  const since7d = isoDaysAgo(7);
  const since30d = isoDaysAgo(30);

  let profile = await safeSelect<Record<string, unknown> | null>(
    "user_profiles",
    (table) => supabase.from(table).select("*").eq("user_id", userId).maybeSingle()
  );

  if (!profile) {
    profile = await safeSelect<Record<string, unknown> | null>(
      "onboarding_answers",
      (table) => supabase.from(table).select("*").eq("user_id", userId).maybeSingle()
    );
  }

  const activeProgram = await safeSelect<Record<string, unknown> | null>(
    "programs",
    (table) =>
      supabase
        .from(table)
        .select("id,user_id,name,difficulty,plan_json,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
  );

  const workoutSessions =
    (await safeSelect<Array<Record<string, unknown>>>("workout_sessions", (table) =>
      supabase
        .from(table)
        .select("id,created_at")
        .eq("user_id", userId)
        .gte("created_at", since14d)
    )) ?? [];

  let workoutSets: Array<Record<string, unknown>> = [];
  const sessionIds = workoutSessions
    .map((session) => session.id)
    .filter((id): id is string | number => id !== null && id !== undefined);

  if (sessionIds.length > 0) {
    workoutSets =
      (await safeSelect<Array<Record<string, unknown>>>("workout_sets", (table) =>
        supabase
          .from(table)
          .select("id,session_id,created_at")
          .in("session_id", sessionIds)
      )) ?? [];
  }

  const meals7d =
    (await safeSelect<Array<Record<string, unknown>>>("meal_logs", (table) =>
      supabase
        .from(table)
        .select("id,created_at")
        .eq("user_id", userId)
        .gte("created_at", since7d)
    )) ?? [];

  const weight30d =
    (await safeSelect<Array<Record<string, unknown>>>("weight_entries", (table) =>
      supabase
        .from(table)
        .select("id,created_at")
        .eq("user_id", userId)
        .gte("created_at", since30d)
    )) ?? [];

  return {
    user_id: userId,
    profile,
    active_program: activeProgram,
    workouts_14d: { sessions: workoutSessions, sets: workoutSets },
    meals_7d: meals7d,
    weight_30d: weight30d,
  };
}
