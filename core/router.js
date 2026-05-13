const config = require("../config/config");

function routeIntent(intent) {
    switch (intent) {
        case "support":
            return config.emails.support;

        case "sales":
            return config.emails.sales;

        case "complaint":
            return config.emails.complaints;

        case "human":
            return config.emails.human;

        default:
            return config.emails.support;
    }
}

module.exports = { routeIntent };