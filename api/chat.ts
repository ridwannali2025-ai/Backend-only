import { openai } from "../lib/openai";

export const config = { runtime: "edge" };

type ChatRole = "user" | "assistant" | "system";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatRequestBody {
  userId: string;
  messages: ChatMessage[];
  goal?: string;
  phase?: string;
  summary?: string;
}

interface ChatResponseBody {
  id: string;
  role: "assistant";
  content: string;
  timestamp: string;
}

const systemPrompt = `You are a personalized fitness coach. Give concise, actionable replies that respect the user's goal, training phase, and any constraints. Keep tone supportive and direct. Avoid medical advice beyond general guidance.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body?.userId || !body?.messages || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Missing userId or messages" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const contextParts = [
      body.goal ? `Goal: ${body.goal}` : null,
      body.phase ? `Phase: ${body.phase}` : null,
      body.summary ? `Program: ${body.summary}` : null,
    ].filter(Boolean);

    const contextMessage: ChatMessage = {
      role: "system",
      content: `${systemPrompt}${contextParts.length ? `\nContext:\n${contextParts.join("\n")}` : ""}`,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [contextMessage, ...body.messages],
    });

    const content = completion.choices[0]?.message?.content ?? "Let’s keep going—how can I help?";
    const responseBody: ChatResponseBody = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
