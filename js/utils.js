// --- Pure Utility Functions ---

export function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[s]);
}

export function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export function base64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function genSalt(len = 16) {
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return bufToBase64(a.buffer);
}

export async function deriveKey(password, saltBase64, iterations = 10000) {
    const enc = new TextEncoder();
    const salt = base64ToBuf(saltBase64);
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name: 'PBKDF2'}, false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations, hash: 'SHA-256'}, keyMaterial, 256);
    return bufToBase64(derivedBits);
}

export function generateAvatarSvgDataUri(name, color) {
    const initial = (name || '?').charAt(0).toUpperCase();
    const bg = color || '#333333';
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
            <rect width="100" height="100" fill="${encodeURIComponent(bg)}" />
            <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="45" font-weight="bold" fill="#ffffff">
                ${escapeHtml(initial)}
            </text>
        </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${svg}`;
}

export function parseTimecodes(text, canControlPlayer) {
    const escaped = escapeHtml(text);
    return canControlPlayer
        ? escaped.replace(/(\d{1,2}:\d{2})/g, '<button class="timecode-btn" data-time="$1">$1</button>')
        : escaped.replace(/(\d{1,2}:\d{2})/g, '<span class="timecode-btn disabled">$1</span>');
}