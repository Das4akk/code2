class Utils {
    static $(id) { return document.getElementById(id); }

    static toast(msg, type = 'info') {
        const container = Utils.$('toast-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'toast';
        div.style.borderLeft = `4px solid ${type === 'error' ? 'var(--danger)' : 'var(--accent)'}`;
        div.innerText = msg;
        container.appendChild(div);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 4000);
    }

    static escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, match => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[match];
        });
    }

    static showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = Utils.$(screenId);
        if (screen) screen.classList.add('active');
    }

    static generateCryptoId(length = 16) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    static async hashPassword(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 10000, hash: 'SHA-256' }, keyMaterial, 256);
        return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
    }

    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    static injectFixes() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* РђРЅРёРјР°С†РёСЏ Р»РµРІРёС‚Р°С†РёРё */
            @keyframes levitate {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
            }
            .glass-panel, .room-card, .user-card, .msg-bubble, .friend-item, .toast {
                animation: levitate 6s ease-in-out infinite;
                will-change: transform;
            }
            .room-card { animation-delay: 1s; }
            .user-card { animation-delay: 2s; }
            
            /* Р¤РёРєСЃ СЂР°Р·РјРµСЂРѕРІ РїР»РµРµСЂР° */
            #native-player {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                border-radius: 16px;
                background: #000;
            }
            .video-container {
                min-height: 35vh; /* РњРѕР±РёР»СЊРЅС‹Р№ РјРёРЅРёРјСѓРј */
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Р¤РёРєСЃ РјРѕР±РёР»СЊРЅРѕРіРѕ СЃРєСЂРѕР»Р»Р° Рё UI */
            @media (max-width: 1024px) {
                .rooms-grid {
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch;
                    max-height: 70vh;
                    padding-bottom: 120px;
                }
                .lobby-layout { display: flex !important; flex-direction: column; overflow-y: auto; }
                .sidebar { position: relative !important; left: 0 !important; width: 100% !important; height: auto !important; padding-top: 10px !important; box-shadow: none !important; border-right: none !important; border-bottom: 1px solid var(--border); }
                .burger-btn { display: none !important; } /* РЈР±РёСЂР°РµРј РїРѕР»Р·СѓРЅРѕРє */
                .logo { font-size: 32px !important; font-weight: 900; letter-spacing: 2px; background: linear-gradient(90deg, #fff, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 auto; text-align: center; width: 100%; display: block;}
                .mobile-header { justify-content: center !important; }
            }
            
            /* Р‘РµР»Рѕ-СЃРµСЂС‹Р№ Р±РµР№РґР¶ РѕРЅР»Р°Р№РЅР° РІ Р»РѕР±Р±Рё */
            #custom-online-badge {
                background: transparent;
                color: #aaa;
                font-size: 14px;
                font-weight: 600;
                padding: 10px 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #custom-online-badge::before {
                content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: #aaa; box-shadow: 0 0 8px rgba(255,255,255,0.5);
            }
            .original-badge { display: none !important; }

            /* РџР›РђРЁРљР Р РћР›Р•Р™ */
            .role-badge {
                display: inline-block;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 6px;
                margin-left: 8px;
                text-transform: uppercase;
                vertical-align: middle;
                letter-spacing: 0.5px;
            }
            .badge-creator {
                background: rgba(255, 71, 87, 0.15);
                color: #ff4757;
                border: 1px solid rgba(255, 71, 87, 0.4);
                box-shadow: 0 0 8px rgba(255, 71, 87, 0.2);
            }
            .badge-moderator {
                background: rgba(255, 165, 2, 0.15);
                color: #ffa502;
                border: 1px solid rgba(255, 165, 2, 0.4);
                box-shadow: 0 0 8px rgba(255, 165, 2, 0.2);
            }
        `;
        document.head.appendChild(style);

        const originalBadge = document.querySelector('.online-counter-badge');
        if (originalBadge) originalBadge.classList.add('original-badge');

        const roomsMain = document.querySelector('.rooms-main');
        if (roomsMain) {
            const customBadge = document.createElement('div');
            customBadge.id = 'custom-online-badge';
            customBadge.innerHTML = `РЎРµР№С‡Р°СЃ РІ РєРѕРјРЅР°С‚Р°С… - <span id="global-online-count">0</span>`;
            roomsMain.insertBefore(customBadge, roomsMain.firstChild);
        }

        if (!Utils.$('btn-google-login')) {
            const btnLogin = document.createElement('button');
            btnLogin.id = 'btn-google-login';
            btnLogin.className = 'secondary-btn';
            btnLogin.innerHTML = 'рџЊђ Р’РѕР№С‚Рё С‡РµСЂРµР· Google';
            btnLogin.style.marginTop = '10px';
            Utils.$('login-form').appendChild(btnLogin);

            const btnReg = document.createElement('button');
            btnReg.id = 'btn-google-reg';
            btnReg.className = 'secondary-btn';
            btnReg.innerHTML = 'рџЊђ Р РµРіРёСЃС‚СЂР°С†РёСЏ С‡РµСЂРµР· Google';
            btnReg.style.marginTop = '10px';
            Utils.$('reg-form').appendChild(btnReg);
        }
    }
}


class BackgroundFX {
    static init() {
        const canvas = Utils.$('particle-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let dots = [];
        let isTabVisible = true;
        let mouse = { x: null, y: null, radius: 150 };
        
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize);
        resize();

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.x;
            mouse.y = e.y;
        });
        window.addEventListener('mouseout', () => {
            mouse.x = undefined; mouse.y = undefined;
        });
        
        class Dot {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.4; 
                this.vy = (Math.random() - 0.5) * 0.4;
                this.size = Math.random() * 2 + 1;
            }
            update() {
                this.x += this.vx; this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouse.radius) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (mouse.radius - distance) / mouse.radius;
                        this.x -= forceDirectionX * force * 2;
                        this.y -= forceDirectionY * force * 2;
                    }
                }
            }
            draw() {
                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            }
        }
        
        for (let i = 0; i < 90; i++) dots.push(new Dot()); 
        
        function animate() {
            if (!isTabVisible) return; 
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < dots.length; i++) {
                dots[i].update(); dots[i].draw();
                for (let j = i + 1; j < dots.length; j++) {
                    let dx = dots[i].x - dots[j].x;
                    let dy = dots[i].y - dots[j].y;
                    let dist = dx * dx + dy * dy; 
                    if (dist < 25000) { 
                        ctx.strokeStyle = `rgba(100, 200, 255, ${0.2 - Math.sqrt(dist) / 1000})`; 
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        animate();

        document.addEventListener("visibilitychange", () => {
            isTabVisible = !document.hidden;
        });
    }
}

// ============================================================================
// 3. РђР’РўРћР РР—РђР¦РРЇ Р РЎРўР РћР“РР• РџР РћР’Р•Р РљР РџР РћР¤РР›Р•Р™
// ============================================================================


export { Utils, BackgroundFX };
