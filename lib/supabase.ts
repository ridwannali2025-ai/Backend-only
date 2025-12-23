import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { env } from "./env";

export function createAnonSupabaseClient(accessToken?: string) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return null;
  }

  const options = accessToken
    ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    : undefined;

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const decoded = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(req: Request): string | null {
  const token = getBearerToken(req);
  if (token) {
    const payload = decodeJwtPayload(token);
    const sub = payload?.sub;
    if (typeof sub === "string" && sub.trim().length > 0) {
      return sub;
    }
  }

  const fallback = req.headers.get("x-user-id");
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  return null;
}

function isMissingRelation(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message || "").toLowerCase();
  return error.code === "42P01" || message.includes("does not exist") || message.includes("relation");
}

export async function safeSelect<T>(
  table: string,
  queryFn: (tableName: string) => PromiseLike<{ data: T | null; error: PostgrestError | null }>
): Promise<T | null> {
  try {
    const { data, error } = await queryFn(table);
    if (error) {
      if (isMissingRelation(error)) {
        return null;
      }

      console.warn(`Supabase select error on ${table}:`, error.message);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.warn(`Supabase select exception on ${table}:`, error);
    return null;
  }
}
