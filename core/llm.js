const Groq = require("groq-sdk");
const config = require("../config/config");

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// fallback so it NEVER breaks again
const MODEL =
    config.GROQ_MODEL ||
    process.env.GROQ_MODEL ||
    "llama-3.3-70b-versatile";

async function callGroq(messages, temperature = 0.3) {
    try {
        if (!Array.isArray(messages)) {
            throw new Error("callGroq expects messages[] array");
        }

        const res = await client.chat.completions.create({
            model: MODEL,
            messages,
            temperature
        });

        return res.choices?.[0]?.message?.content || "";
    } catch (err) {
        console.error("[GROQ ERROR]", err);
        return "";
    }
}

module.exports = { callGroq };