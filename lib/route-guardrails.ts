export const ROUTE_GUARDRAILS = {
  "/api/generate-program": { maxBodyBytes: 50_000, maxOutputTokens: 1_000 },
  "/api/generate-meal-plan": { maxBodyBytes: 30_000, maxOutputTokens: 800 },
  "/api/weekly-checkin": { maxBodyBytes: 10_000, maxOutputTokens: 600 },
  "/api/chat": { maxBodyBytes: 100_000, maxOutputTokens: 1_200 },
  "/api/analyze-progress": { maxBodyBytes: 20_000, maxOutputTokens: 700 },
} as const;

export function isPayloadTooLarge(req: Request, maxBytes: number): boolean {
  const header = req.headers.get("content-length");
  if (!header) {
    return false;
  }

  const size = Number(header);
  if (!Number.isFinite(size)) {
    return false;
  }

  return size > maxBytes;
}
