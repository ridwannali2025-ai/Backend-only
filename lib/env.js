"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
if (!exports.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment");
}
