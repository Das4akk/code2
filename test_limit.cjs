const http = require('http');
for (let i = 0; i < 150; i++) {
    const req = http.request("http://localhost:3000/api/auth/send-code", {
        method: "POST",
        headers: {"Content-Type": "application/json"}
    }, (res) => {
        if (res.statusCode === 429) {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => console.log('429 BODY:', data));
        }
    });
    req.write(JSON.stringify({email: "test@example.com"}));
    req.end();
}
