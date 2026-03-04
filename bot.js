// Library imports
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const nodemailer = require('nodemailer');

// LLM Model and LLAMA interface paths
const LLAMA_SERVER_PATH = path.join(__dirname, 'llama.cpp', 'build', 'bin', 'llama-server.exe');
const MODEL_PATH = path.join(__dirname, 'models', 'mistral-7b-instruct-v0.2.Q4_K_M.gguf');

// LLM local server IP and PORT
const LLAMA_HOST = '127.0.0.1';
const LLAMA_PORT = 8080;



//--------------------------------------------------------------------------------------
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config/config.json', 'utf-8'));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.botEmail,
        pass: config.botEmailPassword
    }
});

const BUSINESS_EMAIL = config.businessEmail;

const SYSTEM_PROMPT = `
You are ${config.botName}, a WhatsApp customer support assistant for ${config.businessName}.
Business info:
${config.businessInfo}

Personality:
${config.personality}

Rules:
- Do not invent services or capabilities not listed
- Do not give prices
- If unsure, ask for clarification
- Guide users toward booking a consultation
- Be concise, confident, and professional
- If the customer wants to speak to a human, inform them that they simply need to write 'speak to human' and it will alert a human represenative to join the chat.
`;
//--------------------------------------------------------------------------------------



// Initiates the llama server
function startLlamaServer() {

    // Console log for the server
    console.log('Starting LLaMA server...');

    // LLM setup
    const args = [
        '-m', MODEL_PATH,
        '--port', LLAMA_PORT,
        '--ctx-size', '512',
        '--threads', '8',
        '--batch-size', '128',
        '--n-predict', '64',
        '--top-k', '20',
        '--top-p', '0.8',
        '--temp', '0.6',
        '--repeat-penalty', '1.1'
    ];

    // Starts the llm
    const llama = spawn(LLAMA_SERVER_PATH, args);


    // LLM normal output
    llama.stdout.on('data', data => {
        console.log(`LLAMA: ${data.toString()}`);
    });


    // Output when an error is thrown
    llama.stderr.on('data', data => {
        console.error(`LLAMA ERR: ${data.toString()}`);
    });

    // Output when the llm closes
    llama.on('close', code => {
        console.log(`LLaMA server exited with code ${code}`);
    });
}



// Waiting loop for LLM to be ready
function waitForLlamaReady(retries = 30) {


    return new Promise((resolve, reject) => {
        const check = () => {
            const req = http.request({
                hostname: LLAMA_HOST,
                port: LLAMA_PORT,
                path: '/',
                method: 'GET'
            }, res => {
                resolve();
            });

            req.on('error', () => {
                if (retries-- === 0) {
                    reject('LLaMA server failed to start');
                } else {
                    setTimeout(check, 1000);
                }
            });

            req.end();
        };

        check();
    });
}

// WhatsApp clinet
const client = new Client({
    authStrategy: new LocalAuth()
});

// Console logs the QR code
client.on('qr', (qr) => {
    console.log('Scan this QR code with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Indication for whatsapp client running
client.on('ready', () => {
    console.log('WhatsApp bot is running!');
});

// user tracking and memory 
const userData = {};
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 min
const MEMORY_SIZE = 6; // store last 6 messages per user

// Scores the client for how important and good the client is
function scoreLead(conversation) {
    const text = conversation.map(m => m.content.toLowerCase()).join(' ');

    let score = 0;

    if (/(quote|price|cost)/.test(text)) score += 3;
    if (/(install|setup|repair|fix|support)/.test(text)) score += 3;
    if (/(urgent|asap|today|immediately)/.test(text)) score += 2;
    if (/(speak to human|call me)/.test(text)) score += 3;

    if (score >= 6) return 'HOT 🔥';
    if (score >= 3) return 'WARM ⚠️';
    return 'COLD ❄️';
}


// extracts the phone number from the userID
function extractPhone(userId) {
    return userId.split('@')[0]; // WhatsApp JID → phone number
}


// Quereis the LLM
function queryLLM(conversationHistory) {

    return new Promise((resolve, reject) => {
        const promptText = SYSTEM_PROMPT + '\n' + conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n') + '\nAssistant:';
        const postData = JSON.stringify({
            prompt: promptText,
            n_predict: 100,
            temperature: 0.6,
            top_k: 20,
            top_p: 0.8,
            repeat_penalty: 1.1,
            stop: ["Customer:", "Assistant:"]
        });

        const options = {
            hostname: LLAMA_HOST,
            port: LLAMA_PORT,
            path: '/completion',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Connection': 'keep-alive'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.content.trim());
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Helper to have whatsapp typing being shown while LLM is being queried
async function sendTypingUntilReply(message, asyncCallback) {
    const chat = await message.getChat();
    let stopTyping = false;
    const interval = setInterval(() => {
        if (!stopTyping) chat.sendStateTyping();
    }, 2000);

    const result = await asyncCallback();

    stopTyping = true;
    clearInterval(interval);

    return result;
}

// Sends email
async function sendEmail(userId, conversation, summary = '') {
    const phone = extractPhone(userId);
    const leadScore = scoreLead(conversation);
    const chatText = conversation.map(m => `${m.role}: ${m.content}`).join('\n');

    const mailOptions = {
        from: config.botEmail,
        to: BUSINESS_EMAIL,
        subject: `New ${leadScore} Lead from ${phone}`,
        text:
`Lead Rating: ${leadScore}
Customer Phone: ${phone}

Summary:
${summary || 'N/A'}

Full Conversation:
${chatText}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent for ${userId}`);
    } catch (err) {
        console.error('Email send error:', err);
    }
}

// Listener for messeges being sent to the whatsapp client and responds to them
client.on('message', async (message) => {

    // Ignore messages by the bot
    if (message.fromMe) return;

    // Pulls the userid and time form the user
    const userId = message.from;
    const now = Date.now();

    if (!userData[userId]) {
        userData[userId] = {
            lastMessageTime: 0,
            humanActive: false,
            conversation: [],
            pendingServiceRequest: false,
            welcomed: false
        };
    }

    const user = userData[userId];
    console.log(`Message from ${userId}: ${message.body}`);


    // -------------------- UX Enhancements --------------------

    // Prevent rapid double-processing
    if (user.lastMessageTime && (now - user.lastMessageTime < 1500)) {
        return;
    }

    // Greeting detection
    const greetingPatterns = [
        /^hi$/i,
        /^hello$/i,
        /^hey$/i,
        /^good (morning|afternoon|evening)$/i
    ];

    const isGreetingOnly = greetingPatterns.some(p => 
        p.test(message.body.trim())
    );

    if (isGreetingOnly) {

        if (!user.welcomed) {
            await message.reply(
                `Welcome to ${config.businessName}.\n\n` +
                `I'm ${config.botName}, your virtual assistant. ` +
                `I can help with IT support, service requests, or general inquiries.\n\n` +
                `How may I assist you today?`
            );
            user.welcomed = true;
        } else {
            await message.reply(
                `Hello 👋 How can I assist you today?`
            );
        }

        user.lastMessageTime = now;
        return;
    }

    // Service info detection
    const serviceInfoPatterns = [
        /(what do you do)/i,
        /(services do you offer)/i,
        /(what services)/i
    ];

    if (serviceInfoPatterns.some(p => p.test(message.body))) {
        await message.reply(
            `${config.businessName} provides:\n\n` +
            `• IT Support & Troubleshooting\n` +
            `• Network Setup & Configuration\n` +
            `• System Automation\n` +
            `• Custom Software Development\n` +
            `• Embedded & Hardware Solutions\n` +
            `• Cybersecurity Consultation\n\n` +
            `Would you like assistance with a specific service?`
        );

        user.lastMessageTime = now;
        return;
    }

    // Urgency detection
    const urgentPatterns = [
        /(server down)/i,
        /(system offline)/i,
        /(urgent)/i,
        /(asap)/i,
        /(immediately)/i
    ];

    if (urgentPatterns.some(p => p.test(message.body))) {
        await message.reply(
            `⚠️ I understand this may be urgent.\n\n` +
            `Please describe the issue in detail, and I will prioritize notifying our technical team.`
        );
    }



    if (now - user.lastMessageTime > INACTIVITY_LIMIT) {

        if (user.pendingServiceRequest && user.conversation.length > 0) {
            await sendEmail(userId, user.conversation, 'User did not finish service description');
        }

        user.humanActive = false;
        user.conversation = [];
        user.pendingServiceRequest = false;
    }

    // Track conversation
    user.conversation.push({ role: 'Customer', content: message.body });
    if (user.conversation.length > MEMORY_SIZE) user.conversation.shift();

    // Human handoff
    if (message.body.toLowerCase().includes('speak to human')) {
        if (!user.humanActive) {
            user.humanActive = true;

            await sendEmail(userId, user.conversation, 'User requested human assistance');

            await message.reply(
                "A human team member has been notified and will join the conversation shortly to assist you."
            );
        }
        user.lastMessageTime = now;
        return;
    }

    // Request handling
    if (user.pendingServiceRequest) {

        if (user.conversation.length > MEMORY_SIZE) user.conversation.shift();

        // Ask LLaMA to summarize and categorize
        const summaryPrompt = [
            ...user.conversation,
            { role: 'Assistant', content: 'Please summarize and categorize the requested IT service in 1-2 sentences.' }
        ];

        let summary = '';

        try {
            summary = await sendTypingUntilReply(message, async () => {
                return await queryLLM(summaryPrompt);
            });

            await message.reply(`Thanks! I've summarized your request:\n\n${summary}\n\nOur team will contact you shortly.`);

            // Send email with chat history + summary
            await sendEmail(
                userId,
                [...user.conversation, { role: 'Assistant', content: summary }],
                summary
            );

        } catch (err) {
            console.error('LLM Error:', err);
            await message.reply("Sorry, I couldn't process your service request. 😔");
        }

        // Reset pending request
        user.pendingServiceRequest = false;

        // Track Annca's reply
        user.conversation.push({ role: 'Assistant', content: summary || '' });
        if (user.conversation.length > MEMORY_SIZE) user.conversation.shift();

    } else {

        // Detect potential service request keywords
        const serviceIntentPatterns = [
            /need.+(help|support|assist)/i,
            /(fix|repair|install|setup|configure)/i,
            /(quote|pricing|cost|price)/i,
            /(problem|issue|error|not working|broken)/i,
            /(service|project|task|job)/i
        ];
        const isServiceRequest = serviceIntentPatterns.some(p => p.test(message.body));


        if (isServiceRequest) {
            // Ask user to describe the service
            await message.reply(
                "Thanks! Could you please describe the service or task you would like UB Solutions to assist with? Please provide as much detail as possible."
            );
            user.pendingServiceRequest = true;
        } else {
            // Normal LLaMA response
            try {
                const reply = await sendTypingUntilReply(message, async () => {
                    return await queryLLM(user.conversation);
                });

                if (!reply || reply.length < 5) {
                    await message.reply(
                        "Could you please provide a bit more detail so I can assist you properly?"
                    );
                } else {
                    await message.reply(reply);
                }
                
                // Track Annca's reply
                user.conversation.push({ role: 'Assistant', content: reply });
                if (user.conversation.length > MEMORY_SIZE) user.conversation.shift();

            } catch (err) {
                console.error('LLM Error:', err);
                await message.reply("Sorry, I'm having trouble responding right now. 😔");
            }
        }
    }

    user.lastMessageTime = now;
});


// Boot sequence for the system
(async () => {
    startLlamaServer();
    console.log('Waiting for LLaMA to be ready...');
    await waitForLlamaReady();
    console.log('LLaMA server is ready!');
    client.initialize();
})();
