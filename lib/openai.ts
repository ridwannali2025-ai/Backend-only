// Backend-only lib/openai.ts

import OpenAI from "openai";
import { env } from "./env";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export type OpenAIResult = {
  content: string
}

export async function callOpenAI(prompt: string): Promise<OpenAIResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });
  
  return {
    content: completion.choices[0]?.message?.content ?? "",
  };
}