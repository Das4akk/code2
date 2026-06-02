const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

const regex = /class SupportSystem \{[\s\S]*?\}\nwindow\.SupportSystem = SupportSystem;/;

const newClass = `class SupportSystem {
    static activeTicketId = null;
    static unsubList = null;
    static unsub = null;
    static globalUnsub = null;
    static typingUnsub = null;
    static lastMessageDates = {};
    static lastStatuses = {};
    static typingTimer = null;
    static BANNED_USERS = new Set();
    static TEMPLATES = {
        'Приветствие': 'Здравствуйте! Чем я могу вам помочь?',
        'Ожидание': 'Пожалуйста, подождите, мы уточняем информацию.',
        'Закрытие': 'Рады были помочь! Тикет закрывается.'
    };

    static initGlobalListener() {
        const uid = AppState.currentUser?.uid;
        if (!uid) return;
        const profile = AppState.currentUserProfile || {};
        const isAdmin = AdminPanel.isCreatorProfile(profile, uid) || AdminPanel.isOperatorProfile(profile, uid);
        
        // Use implicit import for onValue/ref
        const dbLocal = window.db || (typeof db !== 'undefined' ? db : null);
        if (dbLocal && typeof onValue !== 'undefined') {
            onValue(ref(dbLocal, 'support_bans'), snap => {
                this.BANNED_USERS = new Set(Object.keys(snap.val() || {}));
            });
        }
        
        if (this.globalUnsub) this.globalUnsub();
        
        this.globalUnsub = onValue(ref(db, 'support_tickets'), snap => {
            const val = snap.val() || {};
            let hasUnread = false;
            
            Object.entries(val).forEach(([id, t]) => {
                if (!isAdmin && t.creatorUid !== uid) return;
                
                if (!isAdmin && this.lastStatuses[id] && this.lastStatuses[id] !== t.status) {
                    if (t.status === 'open') Utils.toast(\`Ваш тикет "\${t.title}" был открыт\`, 'info');
                    if (t.status === 'closed') Utils.toast(\`Ваш тикет "\${t.title}" был закрыт\`, 'info');
                }
                this.lastStatuses[id] = t.status;

                const msgs = t.messages || {};
                const msgKeys = Object.keys(msgs);
                if (msgKeys.length > 0) {
                    const lastMsg = msgs[msgKeys[msgKeys.length - 1]];
                    
                    if (this.lastMessageDates[id] && lastMsg.timestamp > this.lastMessageDates[id]) {
                        if ((!isAdmin && lastMsg.isAdmin) || (isAdmin && !lastMsg.isAdmin)) {
                            if (this.activeTicketId !== id) {
                                hasUnread = true;
                                Utils.toast(\`Новое сообщение в тикете "\${t.title}"\`, 'info');
                            }
                        }
                    }
                    this.lastMessageDates[id] = lastMsg.timestamp;
                }
            });

            const navIcon = Utils.$('nav-support') || Utils.$('nav-support-staff');
            if (navIcon) {
                let badge = navIcon.querySelector('.support-badge');
                if (hasUnread) {
                    if (!badge) {
                        badge = document.createElement('div');
                        badge.className = 'support-badge';
                        badge.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 10px; height: 10px; background: red; border-radius: 50%;';
                        navIcon.style.position = 'relative';
                        navIcon.appendChild(badge);
                    }
                } else if (badge) {
                    badge.remove();
                }
            }
        });
    }

    static async renderTickets() {
        const uid = AppState.currentUser?.uid;
        if (!uid) return;
        const profile = AppState.currentUserProfile || {};
        const isAdmin = AdminPanel.isCreatorProfile(profile, uid) || AdminPanel.isOperatorProfile(profile, uid);
        const isCreator = AdminPanel.isCreatorProfile(profile, uid);
        const list = Utils.$('support-tickets-list');
        
        const panelBtn = Utils.$('btn-support-creator-panel');
        if (panelBtn) {
           panelBtn.style.display = isCreator ? 'block' : 'none';
           panelBtn.onclick = () => this.openCreatorPanel();
        }

        const btnOpenCreate = Utils.$('btn-open-create-ticket-modal');
        if (btnOpenCreate) btnOpenCreate.onclick = () => {
            if (this.BANNED_USERS.has(uid)) return Utils.toast('Вы заблокированы в системе поддержки', 'error');
            const m = Utils.$('modal-create-ticket');
            if(m) m.classList.add('active');
        };

        if (this.unsubList) this.unsubList();
        const dbRef = ref(db, 'support_tickets');
        this.unsubList = onValue(dbRef, snap => {
            const val = snap.val() || {};
            let tickets = Object.entries(val).map(([id, t]) => ({ id, ...t }));
            if (!isAdmin) {
                tickets = tickets.filter(t => t.creatorUid === uid);
            }
            if (tickets.length === 0) {
                list.innerHTML = \`<div style="text-align:center; padding: 20px; color: var(--text-muted);">Тикетов нет</div>\`;
                return;
            }
            tickets.sort((a,b) => b.createdAt - a.createdAt); // newest first
            list.innerHTML = tickets.map(t => {
                const titleStr = Utils.escapeHtml(t.title || 'Без темы');
                const titleEscaped = titleStr.replace(/'/g, "\\\\'").replace(/"/g, '&quot;'); // escape to insert to onclick
                const isOpen = t.status === 'open';
                const statusText = isOpen ? '⚪ В работе' : '🔴 Закрыт';
                const priority = t.priority ? \`<span style="margin-left:8px;font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#fff;">\${t.priority}</span>\` : '';
                const unreadDot = (t.lastActivity && t.lastActivity > (t.readReceipts?.[uid] || 0) && t.lastSender !== uid && (isAdmin || t.lastSenderIsAdmin)) ? \`<div style="width:8px;height:8px;border-radius:50%;background:#ff4757;margin-left:8px;flex-shrink:0;box-shadow:0 0 8px #ff4757;" title="Новые сообщения"></div>\` : '';
                
                return \`
                <div class="dm-chat-item \${this.activeTicketId === t.id ? 'active' : ''}" onclick="SupportSystem.openTicket('\${t.id}')">
                    <div class="dm-chat-avatar" style="background:\${isOpen ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)'}; color:\${isOpen ? '#ffffff' : '#ff4444'}; font-size:20px;">
                        \${t.category === 'Баг' ? '🐛' : t.category === 'Вопрос' ? '❔' : '📝'}
                    </div>
                    <div class="dm-chat-info">
                        <div class="dm-chat-name" style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                           <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${titleStr}</span>
                           \${unreadDot}
                        </div>
                        <div class="dm-chat-last-msg" style="display:flex;align-items:center;">\${statusText}\${isAdmin ? priority : ''}</div>
                    </div>
                </div>\`;
            }).join('');
        });

        const btnNew = Utils.$('btn-new-ticket');
        if (btnNew) btnNew.onclick = async () => {
             if (this.BANNED_USERS.has(uid)) return Utils.toast('Вы заблокированы в системе поддержки', 'error');
            const inputEl = Utils.$('support-new-ticket-title');
            const priorityEl = Utils.$('support-new-ticket-priority');
            const textEl = Utils.$('support-new-ticket-text');
            const title = inputEl ? inputEl.value.trim() : '';
            const priority = priorityEl ? priorityEl.value : 'Средний';
            const text = textEl ? textEl.value.trim() : '';
            
            if (!title || !text) return;
            const newRef = push(ref(db, 'support_tickets'));
            const ts = Date.now();
            await set(newRef, {
                title,
                priority,
                creatorUid: uid,
                status: 'open',
                createdAt: ts,
                lastActivity: ts,
                lastSender: uid
            });
            await push(ref(db, \`support_tickets/\${newRef.key}/messages\`), {
                text: text,
                uid,
                name: profile?.name || 'Пользователь',
                username: profile?.username || uid,
                avatar: profile?.avatar || '',
                isAdmin: false,
                timestamp: ts
            });

            if (inputEl) inputEl.value = '';
            if (textEl) textEl.value = '';
            document.getElementById('modal-create-ticket')?.classList.remove('active');
            SupportSystem.openTicket(newRef.key);
        };
    }

    static async openTicket(id) {
        const uid = AppState.currentUser?.uid;
        this.activeTicketId = id;
        
        await update(ref(db, \`support_tickets/\${id}/readReceipts/\${uid}\`), Date.now());

        const items = document.querySelectorAll('#support-tickets-list .dm-chat-item');
        items.forEach(el => el.classList.remove('active'));
        const clickedItem = Array.from(items).find(el => el.getAttribute('onclick').includes(id));
        if (clickedItem) clickedItem.classList.add('active');
        
        const layoutContainer = Utils.$('support-grid-container');
        if (layoutContainer) layoutContainer.classList.add('chat-active');
        
        const btnBack = Utils.$('btn-support-back');
        if (btnBack) {
            btnBack.style.display = window.innerWidth <= 1024 ? 'block' : 'none';
            btnBack.onclick = () => layoutContainer.classList.remove('chat-active');
        }

        Utils.$('support-no-ticket').style.display = 'none';
        Utils.$('support-active-ticket').style.display = 'flex';
        
        const profile = AppState.currentUserProfile || {};
        const isAdmin = AdminPanel.isCreatorProfile(profile, uid) || AdminPanel.isOperatorProfile(profile, uid);
        
        if (this.unsub) this.unsub();
        this.unsub = onValue(ref(db, \`support_tickets/\${id}\`), (snap) => {
             const t = snap.val();
             if (!t) return;
             if (this.activeTicketId !== id) return;
             
             // Setup auto-read if we are watching this chat
             update(ref(db, \`support_tickets/\${id}/readReceipts/\${uid}\`), Date.now());
             
             Utils.$('support-ticket-title-text').innerText = t.title || 'Без темы';
             const isClosed = t.status === 'closed';
             const openTimeStr = Math.floor((Date.now() - (t.createdAt || Date.now())) / 3600000);
             Utils.$('st-status').innerHTML = isClosed 
                  ? '<span style="color:#ff4444;font-weight:bold;">🔴 Закрыт</span>' 
                  : \`<span style="color:#ffffff;font-weight:bold;">⚪ В работе</span> \${isAdmin ? \`<span style="opacity:0.5;font-weight:normal;font-size:11px;">(Открыт \${openTimeStr} ч. назад)</span>\` : ''}\`;
                  
             if (t.category) {
                 Utils.$('st-tag').style.display = 'block';
                 Utils.$('st-tag').innerText = t.category;
             } else {
                 Utils.$('st-tag').style.display = 'none';
             }

             if (isAdmin) {
                 Utils.$('btn-support-close-ticket').style.display = isClosed ? 'none' : 'block';
                 Utils.$('btn-support-reopen-ticket').style.display = isClosed ? 'block' : 'none';
                 Utils.$('btn-support-close-ticket').onclick = () => this.closeTicket(id);
                 Utils.$('btn-support-reopen-ticket').onclick = () => this.reopenTicket(id);
                 
                 const quickActionsBtn = Utils.$('btn-support-quick-actions');
                 const quickMenu = Utils.$('support-quick-actions-menu');
                 quickActionsBtn.style.display = 'block';
                 quickActionsBtn.onclick = (e) => {
                     e.stopPropagation();
                     if (quickMenu.style.display === 'flex') {
                          quickMenu.style.display = 'none';
                     } else {
                          quickMenu.style.display = 'flex';
                          quickMenu.innerHTML = \`
                             <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; font-weight:bold;">ШАБЛОНЫ:</div>
                             \${Object.keys(this.TEMPLATES).map(k => \`<button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.useTemplate('\${k}', '\${id}')">\${k}</button>\`).join('')}
                             <div style="border-top:1px solid rgba(255,255,255,0.05); margin: 6px 0;"></div>
                             <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px; font-weight:bold;">ТЕГИ:</div>
                             <button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.setCategory('\${id}', 'Баг')">🐛 Баг</button>
                             <button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.setCategory('\${id}', 'Вопрос')">❔ Вопрос</button>
                             <div style="border-top:1px solid rgba(255,255,255,0.05); margin: 6px 0;"></div>
                             <button class="secondary-btn" style="text-align:left; padding:6px 8px; font-size:12px; background:rgba(255,255,255,0.05); border:none;" onclick="SupportSystem.exportTicket('\${id}')">📥 Экспорт как .txt</button>
                             <button class="danger-btn" style="text-align:left; padding:6px 8px; font-size:12px; margin-top:4px;" onclick="SupportSystem.adminBan('\${t.creatorUid}')">🚫 Заблокировать автора</button>
                          \`;
                     }
                 };
                 // Ensure we remove previous event listeners or avoid duplicate globals, using onmousedown instead of addEventListener for simplicity
                 document.onmousedown = (ev) => { 
                     if (quickMenu && !quickMenu.contains(ev.target) && ev.target !== quickActionsBtn) {
                         quickMenu.style.display = 'none'; 
                     }
                 };
             }
             
             const chat = Utils.$('support-ticket-chat');
             const msgs = t.messages || {};
             chat.innerHTML = Object.values(msgs).sort((a,b) => a.timestamp - b.timestamp).map(m => {
                 const isMe = m.uid === uid;
                 const bg = isMe ? 'rgba(255,255,255,0.15)' : (m.isInternal ? 'rgba(255,165,0,0.15)' : 'rgba(255,255,255,0.06)');
                 const avatarHtml = !isMe ? \`<div style="width:32px;height:32px;border-radius:50%;background-image:url('\${m.avatar || ''}');background-size:cover;background-color:#333;flex-shrink:0;cursor:pointer;border:1px solid rgba(255,255,255,0.1);" onclick="ProfileManager.openProfile('\${m.uid}')"></div>\` : '';
                 const internalTag = m.isInternal ? '<span style="color:orange; font-size:10px; font-weight:bold; letter-spacing:0.5px;">[Внутренняя заметка]</span><br>' : '';
                 if (m.isInternal && !isAdmin) return '';
                 
                 const sentDate = new Date(m.timestamp);
                 const timeStr = sentDate.getHours().toString().padStart(2, '0') + ':' + sentDate.getMinutes().toString().padStart(2, '0');
                 
                 return \`
                 <div style="display:flex; gap:10px; align-self: \${isMe ? 'flex-end' : 'flex-start'}; max-width: 85%;">
                     \${avatarHtml}
                     <div style="background: \${bg}; padding: 10px 16px; border-radius: 16px; border-bottom-\${isMe ? 'right' : 'left'}-radius: 4px; border: 1px solid rgba(255,255,255,0.05); position:relative; min-width: 120px;">
                         <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px; font-weight: 600; cursor:pointer;" onclick="ProfileManager.openProfile('\${m.uid}')">
                             \${m.isAdmin ? \`🔹 \${isMe ? 'Вы (Поддержка)' : 'Поддержка'} (\${m.name})\` : (isMe ? 'Вы' : \`\${m.name} @\${m.username||'user'}\`)}
                         </div>
                         <div style="line-height: 1.5; font-size:14px; word-wrap: break-word; margin-bottom:12px;">\${internalTag}\${Utils.escapeHtml(m.text || '')}</div>
                         \${m.image ? \`<img src="\${Utils.escapeHtml(m.image)}" style="max-width: 100%; border-radius: 8px; margin-top: 5px; margin-bottom: 12px; cursor:pointer;" onclick="window.open(this.src)">\` : ''}
                         <div style="position:absolute; bottom:6px; right:12px; font-size:10px; color:rgba(255,255,255,0.4);">
                            \${timeStr}
                         </div>
                     </div>
                 </div>\`;
             }).join('');
             setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 50);
        });

        if (this.typingUnsub) this.typingUnsub();
        this.typingUnsub = onValue(ref(db, \`support_tickets_typing/\${id}\`), snap => {
             const val = snap.val() || {};
             const othersTyping = Object.keys(val).filter(k => k !== uid && (Date.now() - val[k] < 3000));
             Utils.$('support-typing-indicator').style.display = othersTyping.length > 0 ? 'block' : 'none';
        });

        const btnSend = Utils.$('btn-support-send');
        const input = Utils.$('support-msg-input');
        if (btnSend) btnSend.onclick = () => this.sendMessage(id, !!(isAdmin && window._internalNoteToggle));
        if (input) {
            input.onkeypress = (e) => { 
                if (e.key === 'Enter') this.sendMessage(id, !!(isAdmin && window._internalNoteToggle)); 
            };
            input.oninput = () => {
                 if (this.typingTimer) clearTimeout(this.typingTimer);
                 set(ref(db, \`support_tickets_typing/\${id}/\${uid}\`), Date.now());
                 this.typingTimer = setTimeout(() => remove(ref(db, \`support_tickets_typing/\${id}/\${uid}\`)), 3000);
            };
        }

        const btnAttach = Utils.$('btn-support-attach');
        if (btnAttach) {
            btnAttach.onclick = () => {
                const inputImg = document.createElement('input');
                inputImg.type = 'file';
                inputImg.accept = 'image/*';
                inputImg.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    Utils.toast('Обработка картинки...', 'info');
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const img = new Image();
                        img.onload = async () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width; canvas.height = img.height;
                            canvas.getContext('2d').drawImage(img, 0, 0);
                            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                            await this.sendMessage(id, false, '', compressedBase64);
                        };
                        img.src = re.target.result;
                    };
                    reader.readAsDataURL(file);
                };
                inputImg.click();
            };
        }
    }

    static async sendMessage(ticketId, isInternal = false, textOverride = '', imageBase64 = null) {
        if (this.BANNED_USERS.has(AppState.currentUser?.uid)) return Utils.toast('Вы заблокированы в поддержке!', 'error');
        const input = Utils.$('support-msg-input');
        const msg = textOverride || (input ? input.value.trim() : '');
        if (!msg && !imageBase64) return;
        const uid = AppState.currentUser?.uid;
        const profile = AppState.currentUserProfile;
        const isAdmin = AdminPanel.isOperatorProfile(profile, uid) || AdminPanel.isCreatorProfile(profile, uid);
        const ts = Date.now();
        await push(ref(db, \`support_tickets/\${ticketId}/messages\`), {
            text: msg,
            image: imageBase64 || null,
            uid,
            name: profile?.name || 'Пользователь',
            username: profile?.username || uid,
            avatar: profile?.avatar || '',
            isAdmin,
            isInternal,
            timestamp: ts
        });
        await update(ref(db, \`support_tickets/\${ticketId}\`), {
            lastActivity: ts,
            lastSender: uid,
            lastSenderIsAdmin: isAdmin
        });
        if (input) input.value = '';
        if (this.typingTimer) clearTimeout(this.typingTimer);
        remove(ref(db, \`support_tickets_typing/\${ticketId}/\${uid}\`));
        Utils.$('support-quick-actions-menu').style.display='none'; // Close quick menu if open
    }

    static async closeTicket(id) {
        if (!confirm('Закрыть этот тикет?')) return;
        await update(ref(db, \`support_tickets/\${id}\`), { status: 'closed' });
    }

    static async reopenTicket(id) {
        await update(ref(db, \`support_tickets/\${id}\`), { status: 'open' });
    }
    
    static async setCategory(id, cat) {
        await update(ref(db, \`support_tickets/\${id}\`), { category: cat });
        Utils.toast('Категория установлена: ' + cat, 'success');
        Utils.$('support-quick-actions-menu').style.display='none';
    }
    
    static async adminBan(targetUid) {
        if (!confirm('Точно заблокировать пользователя от поддержки?')) return;
        await set(ref(db, \`support_bans/\${targetUid}\`), true);
        Utils.toast('Пользователь заблокирован', 'success');
        Utils.$('support-quick-actions-menu').style.display='none';
    }
    
    static useTemplate(key, id) {
        const text = this.TEMPLATES[key];
        if (text) {
             const input = Utils.$('support-msg-input');
             if(input) {
                 input.value = text;
                 input.focus();
             }
        }
        Utils.$('support-quick-actions-menu').style.display='none';
    }
    
    static async exportTicket(id) {
        const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get}) => get(ref(db, \`support_tickets/\${id}\`)));
        const t = snap.val();
        if(!t) return;
        let exportStr = \`Тикет: \${t.title} (\${t.status})\nСоздан: \${new Date(t.createdAt).toLocaleString()}\n\n\`;
        Object.values(t.messages || {}).sort((a,b)=>a.timestamp-b.timestamp).forEach(m => {
            exportStr += \`[\${new Date(m.timestamp).toLocaleString()}] \${m.name} (\${m.isAdmin?'Поддержка':'Пользователь'}): \${m.text}\n\`;
        });
        const blob = new Blob([exportStr], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = \`ticket_\${id}.txt\`;
        a.click();
        Utils.$('support-quick-actions-menu').style.display='none';
    }
    
    static openCreatorPanel() {
        const alertHtml = \`
            <h3 style="margin-bottom:15px; text-align:center;">Статистика и Инструменты</h3>
            <div style="background:rgba(255,255,255,0.05); padding: 15px; border-radius:12px; font-size:14px; margin-bottom:15px; border: 1px solid rgba(255,255,255,0.1);">
                <div style="margin-bottom:8px;">Заблокированных пользователей: <b>\${this.BANNED_USERS.size}</b></div>
                <button onclick="SupportSystem.clearAllBans()" class="danger-btn" style="padding:6px 12px;font-size:12px;width:100%;">Снять все баны поддержки</button>
            </div>
            <div style="background:rgba(255,255,255,0.05); padding: 15px; border-radius:12px; font-size:13px; color:var(--text-muted); border: 1px solid rgba(255,255,255,0.1); line-height: 1.5; text-align:center;">
                Привет, Создатель! Здесь будут появляться новые инструменты для управления поддержкой.<br><br>
                ✨ Версия поддержки: 2.0.0
            </div>
        \`;
        if (Utils.alert) {
             Utils.alert('Панель Создателя', alertHtml);
        } else {
             console.log("Panel Open!");
        }
    }
    
    static clearAllBans() {
        if(confirm('Точно снять все баны?')) {
            remove(ref(db, 'support_bans')).then(() => Utils.toast('Баны очищены'));
        }
    }
}
window.SupportSystem = SupportSystem;`;

appJs = appJs.replace(regex, newClass);

fs.writeFileSync('app.js', appJs);
console.log('Done replacement');
