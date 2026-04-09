import { GoogleGenAI } from "@google/genai";
try {
    const ai = new GoogleGenAI({ apiKey: undefined });
    console.log("Initialized with undefined");
} catch (e) {
    console.error("Error:", e);
}
