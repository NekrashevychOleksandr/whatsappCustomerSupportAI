const { buildIntentPrompt } = require("../prompts/intentPrompt");

test("builds deterministic prompt", () => {
    const history = [
        { role: "user", content: "My order is late" }
    ];

    const ticket = {
        intent: "support",
        clarity: 0.5
    };

    const prompt = buildIntentPrompt(history, ticket);

    expect(prompt).toContain("CURRENT TICKET STATE");
    expect(prompt).toContain("My order is late");
});