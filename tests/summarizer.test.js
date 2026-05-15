jest.mock("../core/llm", () => ({
    callGroq: jest.fn(() => Promise.resolve("Customer has an issue with delivery"))
}));

const { generateSummary } = require("../core/summarizer");

test("generates summary from history", async () => {
    const history = [
        { role: "user", content: "My package is missing" }
    ];

    const result = await generateSummary(history, "support");

    expect(result).toContain("delivery");
});