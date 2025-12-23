# Phantom AI Backend

Backend API for Phantom AI - a personalized fitness and nutrition program generator.

## Deployment

This backend is deployed on **Vercel** as serverless functions.

## Main Route

### `POST /api/generate-program`

Generates a personalized workout and nutrition program using OpenAI.

**Required Environment Variable:**
- `OPENAI_API_KEY` - Your OpenAI API key

**Request Body:**
```typescript
{
  goal: string;              // "lose_fat" | "build_muscle" | etc
  timelineMonths: number;    // 3, 6, 12, etc.
  heightCm: number;
  weightKg: number;
  age: number;
  sex: string;               // "male" | "female" | "other"
  activityLevel: string;
  daysPerWeek: number;
  experience: string;
  hasInjuries?: boolean;
  injuryDetails?: string;
  dietaryRestrictions?: string[];
  avoidFoods?: string[];
  pastBlockers?: string[];
  notesFromChat?: string;
}
```

**Response:**
```typescript
{
  summary: {
    headline: string;
    whyThisPlanWillWork: string;
  };
  nutrition: {
    caloriesPerDay: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
    notes: string;
  };
  training: {
    splitTitle: string;
    schedule: Array<{
      day: string;
      focus: string;
      notes: string;
    }>;
    globalNotes: string;
  };
}
```

## Example Request

```bash
curl -X POST https://your-vercel-app.vercel.app/api/generate-program \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "lose_fat",
    "timelineMonths": 6,
    "heightCm": 175,
    "weightKg": 80,
    "age": 30,
    "sex": "male",
    "activityLevel": "moderate",
    "daysPerWeek": 4,
    "experience": "intermediate",
    "hasInjuries": false,
    "dietaryRestrictions": ["vegetarian"],
    "pastBlockers": ["lack of time", "intimidation"],
    "notesFromChat": "Prefers morning workouts, solo training"
  }'
```

## Example Response

```json
{
  "summary": {
    "headline": "6-month fat loss plan with 4-day upper/lower split",
    "whyThisPlanWillWork": "This plan creates a sustainable 500-calorie daily deficit while maintaining muscle mass through progressive resistance training. The 4-day split fits your schedule and allows adequate recovery."
  },
  "nutrition": {
    "caloriesPerDay": 2200,
    "proteinGrams": 165,
    "carbsGrams": 220,
    "fatsGrams": 73,
    "notes": "Prioritize protein at each meal to preserve muscle during fat loss. Include complex carbs around workouts for energy."
  },
  "training": {
    "splitTitle": "Upper / Lower 4x per week",
    "schedule": [
      {
        "day": "Monday",
        "focus": "Upper body strength",
        "notes": "Focus on compound movements: bench press, rows, overhead press."
      },
      {
        "day": "Tuesday",
        "focus": "Lower body strength",
        "notes": "Squats, deadlifts, and leg accessories."
      },
      {
        "day": "Thursday",
        "focus": "Upper body hypertrophy",
        "notes": "Higher volume, moderate weight for muscle growth."
      },
      {
        "day": "Friday",
        "focus": "Lower body hypertrophy",
        "notes": "Volume-focused leg day with isolation work."
      }
    ],
    "globalNotes": "Progressive overload each week. Rest days on Wednesday, Saturday, Sunday. Track your lifts to ensure consistent progress."
  }
}
```

