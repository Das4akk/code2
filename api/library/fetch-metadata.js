import { generateGeminiContent, geminiAi } from '../../lib/gemini.js';

export default async function handler(req, res) {
    console.log("[API] /api/library/fetch-metadata", req.method, req.url);

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

        let title = "Без названия";
        let description = "";

        try {
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    title = data.title;
                    description = data.author_name || ""; 
                }
            } else {
                const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }});
                if (fetchRes.ok) {
                    const html = await fetchRes.text();
                    
                    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
                    if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();

                    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
                    if (descMatch && descMatch[1]) description = descMatch[1].trim();
                }
            }
        } catch(e) {
            console.error("Fetch metadata error:", e);
        }

        if (geminiAi) {
            try {
                const prompt = `Ты - креативный ИИ-копирайтер. Составь красивое, привлекающее внимание зрителя описание для видеоролика под названием "${title}". Оригинальное описание (если есть): "${description}". Напиши 1-2 живых предложения, используй подходящие эмодзи и объясни почему это стоит посмотреть. Не пиши ничего лишнего, только само описание.`;
                const aiDescResponse = await generateGeminiContent({
                    contents: prompt
                });
                if (aiDescResponse.text) {
                    description = aiDescResponse.text.trim();
                }
            } catch (aiErr) {
                console.error("AI description failed", aiErr);
            }
        }

        return res.status(200).json({ success: true, title, description });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}
