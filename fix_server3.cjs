const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const regex = /app\.post\('\/api\/custom-auth\/send-code', async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: \`Ошибка SMTP: \$\{e\.message\}\` \}\);\s*\}\s*\}\);/m;

const replacement = `// Отправка 6-значного кода
app.post('/api/custom-auth/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email не указан' });

        const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
        
        verificationCodes.set(email, {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 минут
        });

        const mailOptions = {
            from: process.env.SMTP_USER || 'ваша_почта@gmail.com',
            to: email,
            subject: 'Код подтверждения COWIO',
            html: \`
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; background: #0f0f11; color: #fff; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,143,198,0.3); box-shadow: 0 10px 40px rgba(255,143,198,0.15);">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width: 48px; height: 48px; margin-bottom: 10px;">
                    <h2 style="color: #fff; font-size: 24px; margin-top: 0; margin-bottom: 25px; font-weight: 800; letter-spacing: 0.5px;">Авторизация COWIO</h2>
                    <p style="font-size: 15px; color: #aaa; margin-bottom: 15px; text-align: left;">Здравствуйте!</p>
                    <p style="font-size: 15px; color: #aaa; margin-bottom: 30px; text-align: left; line-height: 1.6;">Вы сделали запрос на получение кода подтверждения. Пожалуйста, введите приведенный ниже секретный код в приложении для подтверждения вашего действия.</p>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
                        <tr>
                            \${code.split('').map(digit => \`
                            <td style="padding: 0 4px;">
                                <div style="display: block; width: 44px; height: 50px; line-height: 50px; font-size: 26px; font-family: monospace; font-weight: 800; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; text-align: center; text-shadow: 0 0 10px rgba(255,255,255,0.3);">
                                    \${digit}
                                </div>
                            </td>
                            \`).join('')}
                        </tr>
                    </table>
                    
                    <div style="font-size: 13px; color: #666; margin-top: 40px; text-align: left; line-height: 1.6; background: rgba(0,0,0,0.5); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                        <strong style="color: #888;">Важная информация:</strong><br><br>
                        • Этот код действителен в течение 10 минут.<br>
                        • Никому не передавайте этот код. Наши сотрудники никогда не попросят вас назвать его.<br>
                        • Если вы не запрашивали отправку кода, возможно, кто-то другой по ошибке ввел ваш email. Просто проигнорируйте и удалите это письмо.
                    </div>
                </div>
            \`
        };

        if (process.env.SMTP_USER === 'ваша_почта@gmail.com') {
            console.log(\`[COWIO MOCK EMAIL] To: \${email}, Verification Code: \${code}\`);
            return res.status(400).json({ error: 'Для отправки писем необходимо УКАЗАТЬ ВАШУ ПОЧТУ (SMTP_USER) и ПАРОЛЬ ПРИЛОЖЕНИЯ (SMTP_PASS) в настройках переменных окружения проекта' });
        }

        await mailTransporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Код отправлен' });
    } catch (e) {
        console.error('Ошибка отправки email:', e);
        res.status(500).json({ error: \`Ошибка SMTP: \${e.message}\` });
    }
});`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.js', code);
