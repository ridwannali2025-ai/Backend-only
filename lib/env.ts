export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
};

if (!env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment");
}












