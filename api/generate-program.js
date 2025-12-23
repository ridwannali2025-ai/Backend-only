"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handler;
const openai_1 = require("../lib/openai");
exports.config = { runtime: "edge" };
async function handler(req) {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Only POST allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }
    let body;
    try {
        body = (await req.json());
    }
    catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
    // Validate required fields
    if (!body.goal || !body.heightCm || !body.weightKg || !body.age || !body.sex || !body.activityLevel || !body.daysPerWeek || !body.experience) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
    try {
        const systemPrompt = `You are a world-class online fitness coach and nutritionist with expertise in program design, periodization, and evidence-based nutrition.

Your task is to create a personalized workout and nutrition program based on the user's profile. You must return ONLY valid JSON—no prose, no explanations, no markdown formatting.

The JSON response MUST match this exact TypeScript interface:

interface ProgramResponse {
  summary: {
    headline: string;              // A compelling one-line summary of the plan
    whyThisPlanWillWork: string;   // 2-3 sentences explaining why this approach fits the user
  };
  nutrition: {
    caloriesPerDay: number;        // Daily calorie target
    proteinGrams: number;          // Daily protein target in grams
    carbsGrams: number;           // Daily carbs target in grams
    fatsGrams: number;            // Daily fats target in grams
    notes: string;                 // Brief nutrition guidance (2-3 sentences)
  };
  training: {
    splitTitle: string;            // e.g. "Upper / Lower 4x per week" or "Push / Pull / Legs 5x per week"
    schedule: Array<{
      day: string;                // Day name: "Monday", "Tuesday", etc.
      focus: string;              // Workout focus: "Upper body strength", "Lower body hypertrophy", etc.
      notes: string;               // Brief notes for this day (1-2 sentences)
    }>;
    globalNotes: string;          // Overall training guidance (3-4 sentences)
  };
}

Guidelines:
- Use evidence-based recommendations (Mifflin-St Jeor for BMR, activity multipliers, etc.)
- Consider the user's goal (fat loss = caloric deficit, muscle gain = surplus, etc.)
- Respect injury limitations and dietary restrictions
- Training split should match daysPerWeek
- Be specific and actionable in all notes
- All numbers must be integers (round appropriately)
- Return ONLY the JSON object, no other text`;
        const userPrompt = `Create a personalized program for this user:

${JSON.stringify(body, null, 2)}

Consider:
- Goal: ${body.goal}
- Timeline: ${body.timelineMonths} months
- Stats: ${body.heightCm}cm, ${body.weightKg}kg, ${body.age} years old, ${body.sex}
- Activity: ${body.activityLevel}
- Training: ${body.daysPerWeek} days per week, ${body.experience} experience
${body.hasInjuries ? `- Injuries: ${body.injuryDetails || "Yes"}` : ""}
${body.dietaryRestrictions?.length ? `- Dietary restrictions: ${body.dietaryRestrictions.join(", ")}` : ""}
${body.avoidFoods?.length ? `- Foods to avoid: ${body.avoidFoods.join(", ")}` : ""}
${body.pastBlockers?.length ? `- Past blockers: ${body.pastBlockers.join(", ")}` : ""}
${body.notesFromChat ? `- Additional notes: ${body.notesFromChat}` : ""}

Return the JSON program now.`;
        const completion = await openai_1.openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.6,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" }
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        // Validate JSON parsing
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (parseError) {
            console.error("Failed to parse JSON from model:", raw);
            return new Response(JSON.stringify({ error: "Invalid JSON from model" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
        // Basic validation of response structure
        if (!parsed.summary || !parsed.nutrition || !parsed.training) {
            return new Response(JSON.stringify({ error: "Invalid response structure from model" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
        return new Response(JSON.stringify(parsed), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    catch (error) {
        console.error("Error generating program:", error);
        return new Response(JSON.stringify({ error: "Program generation failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
