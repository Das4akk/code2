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
        let authorName = "";
        let authorAvatar = "";

        try {
            if (url.includes('youtube.com/c/') || url.includes('youtube.com/channel/') || url.includes('youtube.com/@')) {
                const fetchRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }});
                if (fetchRes.ok) {
                    const html = await fetchRes.text();
                    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
                    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
                    if (titleMatch && titleMatch[1]) authorName = titleMatch[1].trim();
                    if (imageMatch && imageMatch[1]) authorAvatar = imageMatch[1].trim();
                    return res.status(200).json({ success: true, title: authorName, description, authorName, authorAvatar });
                }
            } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    title = data.title;
                    authorName = data.author_name;
                }

                let videoId = "";
                try {
                    if (url.includes('youtube.com/watch')) {
                        videoId = new URL(url).searchParams.get('v');
                    } else if (url.includes('youtu.be/')) {
                        videoId = url.split('youtu.be/')[1].split('?')[0];
                    }
                } catch(e) {}

                if (videoId) {
                    try {
                        const pipedRes = await fetch(`https://pipedapi.smnz.de/streams/${videoId}`);
                        if (pipedRes.ok) {
                            const data = await pipedRes.json();
                            if (data.title) title = data.title;
                            if (data.description) description = data.description;
                            if (data.uploader) authorName = data.uploader;
                            if (data.uploaderAvatar) authorAvatar = data.uploaderAvatar;
                        }
                    } catch(e) {}
                    
                    if (!description || !authorAvatar) {
                        try {
                            const fetchRes = await fetch(url.replace("youtu.be/", "youtube.com/watch?v="), { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7" }});
                            if (fetchRes.ok) {
                                const html = await fetchRes.text();
                                const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
                                if (descMatch && descMatch[1]) description = descMatch[1].trim();
                                
                                const ytScriptMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
                                if (ytScriptMatch && ytScriptMatch[1]) {
                                    try {
                                        const data = JSON.parse(ytScriptMatch[1]);
                                        if (data?.videoDetails?.shortDescription) {
                                            description = data.videoDetails.shortDescription;
                                        }
                                    } catch(e) {}
                                }

                                const authorAvatarMatch = html.match(/<link\s+itemprop="thumbnailUrl"\s+href="([^"]*)"/i);
                                if (authorAvatarMatch && authorAvatarMatch[1]) {
                                    authorAvatar = authorAvatarMatch[1];
                                }
                            }
                        } catch(e) {}
                    }
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

        if (description === "Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube." || description.includes("YouTube")) {
             description = "";
        }

        if (description) {
            description = description.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        }

        return res.status(200).json({ success: true, title, description });
    } catch (e) {
        console.error("[API ERROR]", e);
        return res.status(200).json({ success: false, error: e.message || "Unknown error", fallback: true });
    }
}
