const memory = require("../core/memory");

test("creates user state", () => {
    const state = memory.getUserState("user1");

    expect(state).toHaveProperty("messages");
    expect(state.messages.length).toBe(0);
});

test("adds and trims messages", () => {
    for (let i = 0; i < 20; i++) {
        memory.addMessage("user1", "user", `msg ${i}`);
    }

    const history = memory.getHistory("user1");

    expect(history.length).toBeLessThanOrEqual(12);
});