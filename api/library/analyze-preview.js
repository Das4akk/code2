import { generateGeminiContent, geminiAi } from '../../lib/gemini.js';

export default async function handler(req, res) {
    console.log("[API] /api/library/analyze-preview", req.method, req.url);

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { imageUrl, title, description } = req.body;
        if (!imageUrl || !geminiAi) {
            return res.status(400).json({ success: false, error: "No image or no API key" });
        }

        // Fetch image as base64
        const imgRes = await fetch(imageUrl);
        if(!imgRes.ok) throw new Error("Image fetch failed");
        
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

        const prompt = `Ты - ИИ ассистент, анализирующий превью видеоролика для социальной платформы. Твоя задача: перечислить людей (известных личностей, блогеров, персонажей), которых ты видишь на картинке. Если людей нет или они неизвестны, ответь "Никто". Название видео: "${title}". Описание: "${description}". ВАЖНО: Отвечай строго только именами через запятую, без лишних слов, мыслей или описаний.`;

        const response = await generateGeminiContent({
            contents: {
                parts: [
                    { inlineData: { data: base64Image, mimeType } },
                    { text: prompt }
                ]
            }
        });

        return res.status(200).json({ success: true, people: response.text.trim() });
    } catch (e) {
        console.error("Gemini Preview Analysis Error:", e);
        return res.status(500).json({ success: false, error: e.message });
    }
}
