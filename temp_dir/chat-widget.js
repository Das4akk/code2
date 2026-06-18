(() => {
    // Inject styles
    const style = document.createElement('style');
    style.innerHTML = `
        #gemini-chat-widget {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 100000;
            font-family: "Inter", sans-serif;
            pointer-events: none;
        }
        #gemini-chat-toggle {
            width: 60px;
            height: 60px;
            border-radius: 30px;
            background: linear-gradient(135deg, #2ed573, #1abc9c);
            box-shadow: 0 4px 15px rgba(46, 213, 115, 0.4);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: auto;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            border: 2px solid rgba(255,255,255,0.2);
        }
        #gemini-chat-toggle:hover {
            transform: scale(1.1);
        }
        #gemini-chat-toggle img {
            width: 32px;
            height: 32px;
        }
        #gemini-chat-panel {
            position: absolute;
            bottom: 80px;
            left: 0;
            width: 380px;
            height: 550px;
            background: rgba(15, 15, 20, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            display: flex;
            flex-direction: column;
            pointer-events: auto;
            opacity: 0;
            transform: translateY(20px) scale(0.9);
            visibility: hidden;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            overflow: hidden;
        }
        #gemini-chat-panel.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            visibility: visible;
        }
        #gemini-chat-header {
            padding: 15px 20px;
            background: rgba(0,0,0,0.4);
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        #gemini-chat-header h3 {
            margin: 0;
            color: #fff;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        #gemini-chat-close {
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 20px;
            transition: 0.2s;
        }
        #gemini-chat-close:hover {
            color: #fff;
        }
        #gemini-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .chat-message {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 14px;
            line-height: 1.4;
            color: #fff;
            word-wrap: break-word;
        }
        .chat-message.user {
            align-self: flex-end;
            background: rgba(255,255,255,0.1);
            border-bottom-right-radius: 4px;
        }
        .chat-message.model {
            align-self: flex-start;
            background: rgba(46, 213, 115, 0.15);
            border: 1px solid rgba(46, 213, 115, 0.3);
            border-bottom-left-radius: 4px;
        }
        #gemini-chat-input-area {
            padding: 15px;
            background: rgba(0,0,0,0.2);
            border-top: 1px solid rgba(255,255,255,0.05);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        #gemini-chat-input-row {
            display: flex;
            gap: 10px;
        }
        #gemini-chat-input {
            flex: 1;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 10px 14px;
            color: #fff;
            font-size: 14px;
            outline: none;
            resize: none;
            max-height: 100px;
            font-family: inherit;
        }
        #gemini-chat-input:focus {
            border-color: #2ed573;
        }
        #gemini-chat-send {
            background: #2ed573;
            border: none;
            color: #000;
            border-radius: 12px;
            padding: 0 16px;
            cursor: pointer;
            font-weight: 600;
            transition: 0.2s;
        }
        #gemini-chat-send:hover {
            background: #26b360;
        }
        .chat-options {
            display: flex;
            gap: 5px;
            font-size: 12px;
        }
        .chat-option-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #aaa;
            padding: 4px 10px;
            border-radius: 10px;
            cursor: pointer;
            transition: 0.2s;
            flex: 1;
        }
        .chat-option-btn.active {
            background: rgba(46, 213, 115, 0.2);
            color: #2ed573;
            border-color: rgba(46, 213, 115, 0.4);
        }
        .typing-indicator {
            align-self: flex-start;
            padding: 10px 14px;
            background: rgba(255,255,255,0.05);
            border-radius: 14px;
            border-bottom-left-radius: 4px;
            display: flex;
            gap: 4px;
            align-items: center;
        }
        .typing-dot {
            width: 6px;
            height: 6px;
            background: #888;
            border-radius: 50%;
            animation: typingBounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typingBounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);

    // Create DOM
    const widgetBase = document.createElement('div');
    widgetBase.id = 'gemini-chat-widget';
    widgetBase.innerHTML = `
        <div id="gemini-chat-toggle">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Activity/Sparkles.webp" alt="AI">
        </div>
        <div id="gemini-chat-panel">
            <div id="gemini-chat-header">
                <h3><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Robot.webp" style="width:20px;"> Gemini AI</h3>
                <button id="gemini-chat-close">&times;</button>
            </div>
            <div id="gemini-chat-messages">
                <div class="chat-message model">Привет! Я ИИ-ассистент платформы. Можем пообщаться, или я могу решить любую сложную задачу. Как я могу помочь?</div>
            </div>
            <div id="gemini-chat-input-area">
                <div class="chat-options">
                    <button class="chat-option-btn active" data-complexity="normal">Быстро (Flash)</button>
                    <button class="chat-option-btn" data-complexity="high">Умно (Pro + Thinking)</button>
                </div>
                <div id="gemini-chat-input-row">
                    <textarea id="gemini-chat-input" placeholder="Введите сообщение..." rows="1"></textarea>
                    <button id="gemini-chat-send">▶</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(widgetBase);

    // Logic
    const toggle = document.getElementById('gemini-chat-toggle');
    const panel = document.getElementById('gemini-chat-panel');
    const closeBtn = document.getElementById('gemini-chat-close');
    const input = document.getElementById('gemini-chat-input');
    const sendBtn = document.getElementById('gemini-chat-send');
    const msgsContainer = document.getElementById('gemini-chat-messages');
    const modeBtns = document.querySelectorAll('.chat-option-btn');

    let currentComplexity = 'normal';
    let conversationHistory = []; // {role: 'user'|'model', content: string}

    toggle.onclick = () => panel.classList.toggle('active');
    closeBtn.onclick = () => panel.classList.remove('active');

    modeBtns.forEach(btn => {
        btn.onclick = () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentComplexity = btn.dataset.complexity;
        };
    });

    const addMessage = (role, text) => {
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        div.innerText = text;
        msgsContainer.appendChild(div);
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
    };

    const showTyping = () => {
        const div = document.createElement('div');
        div.className = 'typing-indicator';
        div.id = 'gemini-typing';
        div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        msgsContainer.appendChild(div);
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
    };

    const removeTyping = () => {
        const el = document.getElementById('gemini-typing');
        if (el) el.remove();
    };

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        input.value = '';
        addMessage('user', text);
        conversationHistory.push({ role: 'user', content: text });
        
        showTyping();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: conversationHistory,
                    complexity: currentComplexity
                })
            });
            const data = await res.json();
            
            removeTyping();
            
            if (data.success) {
                addMessage('model', data.text);
                conversationHistory.push({ role: 'model', content: data.text });
            } else {
                addMessage('model', "❌ Ошибка: " + (data.error || "Неизвестная ошибка"));
            }
        } catch (e) {
            removeTyping();
            addMessage('model', "❌ Сетевая ошибка.");
        }
    };

    sendBtn.onclick = sendMessage;
    input.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

})();
