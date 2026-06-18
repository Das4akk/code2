export default async function handler(req, res) {
    console.log("[API]", req.method, req.url);

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method not allowed' });
        }

        const { url } = req.body || {};
        if (!url) return res.status(200).json({ success: false, error: "No URL provided", fallback: true });

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
            } else if (url.includes('rutube.ru')) {
                const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }});
                if (fetchRes.ok) {
                    const html = await fetchRes.text();
                    
                    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
                    if (titleMatch && titleMatch[1]) title = titleMatch[1].trim();

                    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
                    if (descMatch && descMatch[1]) description = descMatch[1].trim();
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
            console.error("Fetch metadata inner error:", e);
        }

        if (description.length > 100) {
            description = description.substring(0, 100).trim() + "...";
        }

        return res.status(200).json({ success: true, title, description });
    } catch (e) {
        console.error("[API ERROR]", e);
        return res.status(200).json({ success: false, error: e.message || "Unknown error", fallback: true });
    }
}
