const fs = require("fs");
const path = require("path");
require("dotenv").config();

let fileConfig = {};

try {
    fileConfig = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config.json"), "utf-8")
    );
} catch (err) {
    console.log("[CONFIG] No config.json found, using .env only");
}

module.exports = {
    // LLM
    groqApiKey: process.env.GROQ_API_KEY,
    model: fileConfig.GROQ_MODEL || process.env.GROQ_MODEL,

    // Bot identity (UI editable)
    botName: fileConfig.BOT_NAME || process.env.BOT_NAME,
    businessName: fileConfig.BUSINESS_NAME || process.env.BUSINESS_NAME,

    // Emails
    emails: {
        support: fileConfig.BUSINESS_EMAIL_SUPPORT || process.env.BUSINESS_EMAIL_SUPPORT,
        sales: fileConfig.BUSINESS_EMAIL_SALES || process.env.BUSINESS_EMAIL_SALES,
        complaints: fileConfig.BUSINESS_EMAIL_COMPLAINTS || process.env.BUSINESS_EMAIL_COMPLAINTS,
        human: fileConfig.BUSINESS_EMAIL_HUMAN || process.env.BUSINESS_EMAIL_HUMAN
    },

    // SMTP secrets
    emailUser: process.env.EMAIL_USER,
    emailPass: process.env.EMAIL_PASS,
    smtpService: process.env.SMTP_SERVICE,

    // WhatsApp session
    whatsappSession: fileConfig.WHATSAPP_SESSION_NAME || "workflow-bot"
};