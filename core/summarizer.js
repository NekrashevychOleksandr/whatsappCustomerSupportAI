const { callGroq } = require("./llm");

async function generateSummary(history, intent) {
    const prompt = `
You are a support summarization engine.

Create a short, clear summary of the customer's issue for a human agent.

Intent:
${intent}

Chat history:
${history.map(m => `${m.role}: ${m.content}`).join("\n")}

Return ONLY a paragraph summary. No JSON.
`;

    const response = await callGroq([
        {
            role: "user",
            content: prompt
        }
    ], 0.2);

    return response.trim();
}

module.exports = { generateSummary };