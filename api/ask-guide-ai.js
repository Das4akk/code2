import { generateGeminiContent, askGroq } from '../../lib/gemini.js';

const guideAiCache = new Map();
const GUIDE_AI_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeGuideText(text = "") {
    return String(text)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s@_-]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildGuideFallback(query = "", docs = "") {
    const qLower = query.toLowerCase().trim();
    const isGreetingOrChat = ["как дела", "привет", "здравствуй", "ты кто", "настроение", "как жизнь", "расскажи о себе", "как ты", "что нового", "добрый день", "доброе утро"].some(s => qLower.includes(s));
    
    if (isGreetingOrChat) {
        return "У меня всё отлично! (Правда, мой нейросетевой мозг сейчас чуть-чуть перегружен от большого количества запросов). Если у тебя есть вопросы по сайту, напиши их, и я постараюсь помочь. Или мы можем просто пообщаться, а также ты можешь посмотреть видео и послушать музыку с друзьями в комнатах!";
    }

    const source = String(docs || "");
    const tokens = normalizeGuideText(query)
        .split(" ")
        .filter((word) => word.length > 2)
        .slice(0, 16);
    const entries = [];
    const entryRe = /В:\s*([^\n]+)\nО:\s*([\s\S]*?)(?=\nВ:|\n\nРаздел|$)/g;
    let match;

    while ((match = entryRe.exec(source))) {
        entries.push({ q: match[1].trim(), a: match[2].trim() });
    }

    let best = null;
    for (const entry of entries) {
        const haystack = normalizeGuideText(`${entry.q} ${entry.a}`);
        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        if (!best || score > best.score) best = { ...entry, score };
    }

    if (best && best.score > 0) {
        return `Не могу подключиться к нейросети из-за лимита обращений, но вот что я нашел в базе данных сайта:\n${best.a}`;
    }

    return "Сложный вопрос. Мой ИИ-модуль сейчас перегружен запросами, поэтому я работаю в базовом режиме. Лучше всего открыть поддержку и задать вопрос там!";
}

function buildGuidePrompt(query, docs) {
    return [
        "Ты дружелюбный, общительный и жизнерадостный ИИ-ассистент платформы COWIO.",
        "Для ответа на специфичные вопросы об устройстве сайта используй базу знаний COWIO ниже.",
        "НО если пользователь просто общается, здоровается (привет, как дела, настроение, что делаешь), отвечает на твои вопросы или говорит на общие темы - поддерживай живой и интересный диалог! Отвечай по-человечески, шути, интересуйся мнением пользователя, предлагай провести время с друзьями, послушать музыку или включить видео в комнатах COWIO.",
        "Не ограничивай себя справочником. Будь открытым ИИ, с которым приятно болтать.",
        "Не будь сухим роботом, не говори 'возможно/похоже', общайся уверенно, лаконично и приветливо.",
        "Если пользователь задает технический вопрос, на который нет ответа в базе, посоветуй обратиться в поддержку.",
        "",
        `База знаний:\n${docs}`,
        "",
        `Ввод пользователя: ${query}`,
    ].join("\n");
}

export default async function handler(req, res) {
    console.log("[API]", req.method, req.url);

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const query = String(req.body?.query || "").trim().slice(0, 600);
        const docs = String(req.body?.docs || "").trim().slice(0, 20000);
        const fallback = buildGuideFallback(query, docs);

        if (!query) {
            return res.status(200).json({ success: true, answer: "Напишите вопрос, и я подберу ответ по справочнику COWIO.", source: "fallback" });
        }

        const cacheKey = `${normalizeGuideText(query)}:${docs.length}`;
        const cached = guideAiCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < GUIDE_AI_CACHE_TTL_MS) {
            return res.status(200).json({ success: true, answer: cached.answer, source: cached.source, cached: true });
        }

        const prompt = buildGuidePrompt(query, docs);
        let answer = "";
        let source = "fallback";

        try {
            console.log(`[Diagnostics] Attempting Groq for question: "${query}"`);
            answer = await askGroq(prompt);
            source = answer ? "groq" : source;
        } catch (e) {
            console.error("[Guide AI] Groq fallback log:", e.message || e);
        }

        if (!answer) {
            try {
                console.log(`[Diagnostics] Attempting Gemini for question: "${query}"`);
                const response = await generateGeminiContent({ contents: prompt });
                answer = response?.text?.trim() || "";
                source = answer ? "gemini" : source;
            } catch (e) {
                console.error("[Guide AI] Gemini fallback explicitly failed in askGemini:", e.stack);
            }
        }

        if (!answer) {
            answer = fallback;
        }

        guideAiCache.set(cacheKey, { answer, source, ts: Date.now() });
        return res.status(200).json({ success: true, answer, source });
    } catch (err) {
        console.error("[API ERROR]", err.stack);
        const safeFallback = "AI temporarily unavailable";
        return res.status(200).json({ 
            success: false, 
            error: err.message || "Unknown error", 
            answer: safeFallback,
            fallback: true,
            source: "error"
        });
    }
}
