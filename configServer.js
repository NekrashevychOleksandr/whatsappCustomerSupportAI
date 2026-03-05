const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

const CONFIG_PATH = path.join(__dirname, 'config', 'config.json');

let botProcess = null;
let botLogs = [];           // Store logs here
const MAX_LOG_LINES = 500;  // Prevent memory overflow

app.use(express.json());
app.use(express.static(path.join(__dirname, 'gui')));



// ================= CONFIG =================

// Load current config
app.get('/api/config', (req, res) => {
    if (fs.existsSync(CONFIG_PATH)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        res.json(data);
    } else {
        res.json({});
    }
});

// Save config
app.post('/api/config', (req, res) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
    res.json({ status: 'saved' });
});



// ================= BOT CONTROL =================

// Start bot
app.post('/start-bot', (req, res) => {

    if (botProcess) {
        return res.json({ message: 'Bot is already running.' });
    }

    botLogs = []; // clear old logs

    botProcess = spawn('node', ['bot.js'], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    // Capture STDOUT
    botProcess.stdout.on('data', (data) => {
        const message = data.toString();
        addLog(message);
        console.log(message); // still show in terminal
    });

    // Capture STDERR

    botProcess.on('close', (code) => {
        addLog(`Bot exited with code ${code}`);
        console.log(`Bot exited with code ${code}`);
        botProcess = null;
    });

    res.json({ message: 'Bot started successfully.' });
});


// Stop bot
app.post('/stop-bot', (req, res) => {

    if (!botProcess) {
        return res.json({ message: 'Bot is not running.' });
    }

    botProcess.kill();
    botProcess = null;

    addLog("Bot stopped manually.");

    res.json({ message: 'Bot stopped successfully.' });
});


// Bot status
app.get('/bot-status', (req, res) => {
    res.json({
        running: botProcess !== null
    });
});


// Get logs
app.get('/bot-logs', (req, res) => {
    res.json({
        logs: botLogs.join('')
    });
});



// ================= LOG HANDLER =================

function addLog(message) {
    botLogs.push(message);

    if (botLogs.length > MAX_LOG_LINES) {
        botLogs.shift();
    }
}



// ================= SERVER START =================

app.listen(PORT, () => {
    console.log(`Config UI running at http://localhost:${PORT}`);
});