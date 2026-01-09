const express = require('express');

const app = express();
const PORT = process.env.WEB_PORT || 3301;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'pickem-web',
        time: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`WEB SERWER DZIAŁA NA http://localhost:${PORT}`);
});