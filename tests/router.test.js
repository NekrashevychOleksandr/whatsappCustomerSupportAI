const { routeIntent } = require("../core/router");

test("routes support intent", () => {
    const email = routeIntent("support");
    expect(email).toBeDefined();
});

test("defaults to support", () => {
    const email = routeIntent("unknown");
    expect(email).toBeDefined();
});