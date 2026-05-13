const memory = new Map();

function getUserState(userId) {
    if (!memory.has(userId)) {
        memory.set(userId, {
            messages: [],
            lastActive: Date.now(),
            context: {}
        });
    }
    return memory.get(userId);
}

function addMessage(userId, role, content) {
    const state = getUserState(userId);

    state.messages.push({ role, content });

    if (state.messages.length > 12) {
        state.messages.shift();
    }

    state.lastActive = Date.now();
}

function getHistory(userId) {
    return getUserState(userId).messages;
}

function clearUser(userId) {
    memory.delete(userId);
}

module.exports = {
    getUserState,
    addMessage,
    getHistory,
    clearUser
};