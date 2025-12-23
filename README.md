# Phantom AI Backend

Backend API for Phantom AI - a personalized fitness and nutrition program generator.

## Deployment

This backend is deployed on **Vercel** as serverless Edge functions.

### Deploying to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Link project: `vercel link` (or `vercel` for new project)
4. Deploy: `vercel --prod`

Or connect your GitHub repo to Vercel dashboard for automatic deployments.

**Required Environment Variables (set in Vercel dashboard):**
- `OPENAI_API_KEY` - Your OpenAI API key

## Response Format (Phase 4A)

All endpoints return a standardized response envelope:

```typescript
{
  "request_id": string;              // Unique request ID (UUID)
  "route": string;                   // Route path (e.g., "/api/generate-program")
  "model_used": string | null;       // AI model used (null in Phase 4A)
  "tokens_in": number | null;        // Input tokens (null in Phase 4A)
  "tokens_out": number | null;       // Output tokens (null in Phase 4A)
  "cost_estimate_usd": number | null; // Cost estimate (null in Phase 4A)
  "result": any | null;              // Success result data
  "error": {                         // Error object (null on success)
    "code": string;
    "message": string;
  } | null
}
```

## API Endpoints

### `POST /api/generate-program`

Generates a personalized workout and nutrition program.

**Phase 4A Status:** Stub endpoint (returns test response)

**Example Request:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/generate-program \
  -H "Content-Type: application/json" \
  -d '{"goal": "lose_fat", "timelineMonths": 6}'
```

**Example Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "route": "/api/generate-program",
  "model_used": null,
  "tokens_in": null,
  "tokens_out": null,
  "cost_estimate_usd": null,
  "result": {
    "status": "stub",
    "message": "generate-program wired",
    "program_version": 1
  },
  "error": null
}
```

### `POST /api/generate-meal-plan`

Generates a personalized meal plan.

**Phase 4A Status:** Stub endpoint

**Example Request:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/generate-meal-plan \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "caloriesPerDay": 2000}'
```

**Example Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440001",
  "route": "/api/generate-meal-plan",
  "model_used": null,
  "tokens_in": null,
  "tokens_out": null,
  "cost_estimate_usd": null,
  "result": {
    "status": "stub",
    "message": "generate-meal-plan wired",
    "meal_plan_version": 1
  },
  "error": null
}
```

### `POST /api/weekly-checkin`

Processes weekly check-in data and provides feedback.

**Phase 4A Status:** Stub endpoint

**Example Request:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/weekly-checkin \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "weekNumber": 1, "workoutsCompleted": 4}'
```

**Example Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440002",
  "route": "/api/weekly-checkin",
  "model_used": null,
  "tokens_in": null,
  "tokens_out": null,
  "cost_estimate_usd": null,
  "result": {
    "status": "stub",
    "message": "weekly-checkin wired",
    "changes": []
  },
  "error": null
}
```

### `POST /api/analyze-progress`

Analyzes user progress over time and provides insights.

**Phase 4A Status:** Stub endpoint

**Example Request:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/analyze-progress \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "startDate": "2024-01-01", "endDate": "2024-01-31"}'
```

**Example Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440003",
  "route": "/api/analyze-progress",
  "model_used": null,
  "tokens_in": null,
  "tokens_out": null,
  "cost_estimate_usd": null,
  "result": {
    "status": "stub",
    "message": "analyze-progress wired",
    "insight": "stub"
  },
  "error": null
}
```

### `POST /api/chat`

Chat endpoint for AI coach conversations (non-streaming stub in Phase 4A).

**Phase 4A Status:** Stub endpoint

**Example Request:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "messages": [{"role": "user", "content": "Hello"}]}'
```

**Example Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440004",
  "route": "/api/chat",
  "model_used": null,
  "tokens_in": null,
  "tokens_out": null,
  "cost_estimate_usd": null,
  "result": {
    "status": "stub",
    "message": "chat wired",
    "reply": "stub reply"
  },
  "error": null
}
```

## Phase 4A Testing

All endpoints are currently stub implementations that return test responses to verify routing works correctly. Replace `https://your-vercel-app.vercel.app` with your actual Vercel deployment URL.

**Error Response Example:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440005",
  "route": "/api/generate-program",
  "model_used": null,
  "tokens_in": null,
  "tokens_out": null,
  "cost_estimate_usd": null,
  "result": null,
  "error": {
    "code": "bad_request",
    "message": "Invalid JSON body"
  }
}
```

**CORS:** All endpoints support CORS and allow POST requests from any origin (configured for iOS app access).

