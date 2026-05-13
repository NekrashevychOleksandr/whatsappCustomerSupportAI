const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");

const { callGroq } = require("./core/llm");
const { getHistory, addMessage } = require("./core/memory");
const { buildIntentPrompt } = require("./prompts/intentPrompt");
const { routeIntent } = require("./core/router");
const { generateSummary } = require("./core/summarizer");
const { sendEmail } = require("./services/emailService");

// -------------------- CLIENT --------------------

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: puppeteer.executablePath(),
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

// -------------------- STATE --------------------

const tickets = {};
const processingLock = new Set();

function getTicket(userId) {
    if (!tickets[userId]) {
        tickets[userId] = {
            intent: null,
            clarity: 0,
            summary: null,
            status: "collecting",
            confirmationAsked: false,
            locked: false
        };
    }
    return tickets[userId];
}

// -------------------- EVENTS --------------------

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("[QR] Scan to login");
});

client.on("ready", () => {
    console.log("Workflow bot running...");
});

// -------------------- MAIN HANDLER --------------------

client.on("message", async (msg) => {
    const userId = msg.from;

    if (processingLock.has(userId)) return;
    processingLock.add(userId);

    // xtract phone number (WhatsApp format: 123456789@c.us)
    const phoneNumber = userId.split("@")[0];

    try {
        const textRaw = msg.body;

        if (!textRaw?.trim()) {
            processingLock.delete(userId);
            return;
        }

        const text = textRaw.trim();
        const lower = text.toLowerCase();

        const ticket = getTicket(userId);

        addMessage(userId, "user", textRaw);

        const history = getHistory(userId);

        console.log("\n--- NEW MESSAGE ---");
        console.log("USER:", userId, "PHONE:", phoneNumber);
        console.log("TEXT:", text);
        console.log("STATUS:", ticket.status);

        // ---------------- HARD LOCK AFTER CONFIRMATION ----------------

        if (ticket.locked) {
            processingLock.delete(userId);
            return;
        }

        // ---------------- TERMINAL STATES ----------------

        if (ticket.status === "confirmed" || ticket.status === "escalated") {
            ticket.locked = true;
            processingLock.delete(userId);
            return;
        }

        // ---------------- HUMAN ESCALATION ----------------

        if (
            lower.includes("human") ||
            lower.includes("agent") ||
            lower.includes("representative")
        ) {
            ticket.status = "escalated";
            ticket.locked = true;

            await msg.reply(
                "I understand. I've forwarded your request to a human support agent who will continue assisting you shortly."
            );

            processingLock.delete(userId);
            return;
        }

        // ---------------- CONFIRMATION FLOW ----------------

        if (ticket.status === "ready") {
            if (!ticket.confirmationAsked) {
                ticket.confirmationAsked = true;

                await msg.reply(
                    `Just to confirm I understood correctly:\n\n👉 ${ticket.summary}\n\nIs that right? (yes / no)`
                );

                processingLock.delete(userId);
                return;
            }

            if (lower === "yes") {
                const emailTarget = routeIntent(ticket.intent);

                const summary = await generateSummary(history, ticket.intent);

                await sendEmail(
                    emailTarget,
                    `[WhatsApp:${phoneNumber}] Support request: ${ticket.intent}`,
                    `--- CUSTOMER IDENTIFICATION ---\n` +
                    `WhatsApp User ID: ${userId}\n` +
                    `Phone Number: ${phoneNumber}\n\n` +

                    `--- INTENT ---\n${ticket.intent}\n\n` +

                    `--- SUMMARY ---\n${summary}\n\n` +

                    `--- FULL CHAT ---\n` +
                    history.map(m => `${m.role}: ${m.content}`).join("\n")
                );

                ticket.status = "confirmed";
                ticket.locked = true;

                await msg.reply(
                    "Thanks for confirming. Your request has been submitted to the support team."
                );

                processingLock.delete(userId);
                return;
            }

            if (lower === "no") {
                ticket.status = "collecting";
                ticket.confirmationAsked = false;

                await msg.reply(
                    "Got it — let’s fix that. What did I misunderstand?"
                );

                processingLock.delete(userId);
                return;
            }
        }

        // ---------------- LLM ANALYSIS ----------------

        let update;

        try {
            const prompt = buildIntentPrompt(history, ticket);

            const response = await callGroq(
                [{ role: "user", content: prompt }],
                0.3
            );

            let cleaned =
                (response || "")
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
                    .trim();

            update = JSON.parse(cleaned);

        } catch (err) {
            await msg.reply(
                "I had trouble understanding that. Could you rephrase it?"
            );

            processingLock.delete(userId);
            return;
        }

        // ---------------- UPDATE STATE ----------------

        ticket.intent = update.intent || ticket.intent;
        ticket.clarity = update.clarity ?? ticket.clarity;
        ticket.summary = update.summary || ticket.summary;

        // ---------------- NEED MORE INFO ----------------

        if (update.needs_more_info) {
            await msg.reply(update.customer_reply);
            processingLock.delete(userId);
            return;
        }

        // ---------------- READY ----------------

        ticket.status = "ready";

        await msg.reply(update.customer_reply);

    } catch (err) {
        console.error("[BOT ERROR]", err);

        await msg.reply(
            "Something unexpected happened while processing your request."
        );
    }

    processingLock.delete(userId);
});

// -------------------- START --------------------

client.initialize();