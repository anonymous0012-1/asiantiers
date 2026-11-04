const config = require('../config/config');

module.exports = {
    isTester: (member) => {
        return member.roles.cache.has(config.roles.tester);
    },
    isBlacklisted: (member) => {
        return member.roles.cache.has(config.roles.blacklist);
    },
    isVerified: (member) => {
        return member.roles.cache.has(config.roles.verified);
    },
    hasPriority: (member) => {
        return config.roles.priority.some(id => member.roles.cache.has(id));
    }
};