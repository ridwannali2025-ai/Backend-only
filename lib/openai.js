"use strict";
// Backend-only lib/openai.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = void 0;
exports.callOpenAI = callOpenAI;
const openai_1 = __importDefault(require("openai"));
const env_1 = require("./env");
exports.openai = new openai_1.default({
    apiKey: env_1.env.OPENAI_API_KEY,
});
async function callOpenAI(prompt) {
    const completion = await exports.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
    });
    return {
        content: completion.choices[0]?.message?.content ?? "",
    };
}
