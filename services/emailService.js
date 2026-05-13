const nodemailer = require("nodemailer");
const config = require("../config/config");

// -------------------- VALIDATION --------------------

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("[EMAIL CONFIG ERROR] Missing EMAIL_USER or EMAIL_PASS in .env");
}

// -------------------- TRANSPORT --------------------

const transporter = nodemailer.createTransport({
    service: config.SMTP_SERVICE || "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// -------------------- SEND EMAIL --------------------

async function sendEmail(to, subject, content) {

    try {

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            throw new Error("Email credentials missing in environment variables");
        }

        const result = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text: content
        });

        console.log("[EMAIL SENT]", result.messageId);

        return result;

    } catch (err) {

        console.error("[EMAIL ERROR]", err);

        return null;
    }
}

module.exports = { sendEmail };