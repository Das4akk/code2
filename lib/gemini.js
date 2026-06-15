import { GoogleGenAI } from '@google/genai';

const GUIDE_AI_CACHE_TTL_MS = 5 * 60 * 1000;
const GUIDE_AI_TIMEOUT_MS = Number(process.env.GUIDE_AI_TIMEOUT_MS || 6500);
const GUIDE_AI_MODEL = process.env.GROQ_AI_MODEL || "llama-3.1-8b-instant";
const geminiKey = process.env.GEMINI_API_KEY || "AIzaSyBx-rT_JZolf1jHh0bKN5P7c4rrgq9BQGE";

export const geminiAi = geminiKey ? new GoogleGenAI({ 
    apiKey: geminiKey,
    httpOptions: {
        headers: {
            'User-Agent': 'aistudio-build'
        }
    }
}) : null;

if (geminiKey.startsWith('AIzaSyBx-rT_')) {
    console.warn("[Diagnostics] Using default fallback Gemini API key. If hitting rate limits or 404s, please configure a custom GEMINI_API_KEY in Vercel.");
} else if (geminiKey) {
    console.log("[Diagnostics] Custom Gemini API key is configured.");
} else {
    console.warn("[Diagnostics] Gemini API key is MISSING.");
}

export async function withTimeout(taskFactory, timeoutMs = GUIDE_AI_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await taskFactory(controller.signal);
    } finally {
        clearTimeout(timer);
    }
}

export async function generateGeminiContent(options, timeoutFn = withTimeout) {
    if (!geminiAi) throw new Error("Gemini API not configured");
    
    const modelsToTry = [
        "gemini-3.5-flash", 
        "gemini-2.0-flash", 
        "gemini-1.5-flash-latest", 
        "gemini-1.5-flash"
    ];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            console.log(`[Diagnostics] Trying Gemini model: ${model}`);
            const response = await timeoutFn(() =>
                geminiAi.models.generateContent({
                    model: model,
                    ...options
                })
            );
            return response;
        } catch (e) {
            console.warn(`[Diagnostics] Model ${model} failed:`, e.status, e.message);
            lastError = e;
            if (e.status !== "NOT_FOUND" && e.status !== 404) {
                break; // Stop on auth errors / rate limits
            }
        }
    }
    throw lastError;
}

export async function safeGeminiCall(fn) {
    try {
        return await fn();
    } catch (e) {
        console.error("[Gemini Error]", e.stack);
        return {
             success: false,
             fallback: true,
             data: null,
             error: e.message
        };
    }
}

export async function askGroq(prompt) {
    if (!process.env.GROQ_API_KEY) return "";
    return withTimeout(async (signal) => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            signal,
            body: JSON.stringify({
                model: GUIDE_AI_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 420,
            }),
        });

        if (!response.ok) throw new Error(`Groq HTTP ${response.status}`);
        const data = await response.json();
        return data?.choices?.[0]?.message?.content?.trim() || "";
    });
}
