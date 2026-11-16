const roleConfig = require('./roleConfig');

module.exports = {
    isTester: (member) => {
        const roleId = roleConfig.getRoleIdSync('tester');
        return !!roleId && member.roles.cache.has(roleId);
    },
    isBlacklisted: (member) => {
        const roleId = roleConfig.getRoleIdSync('blacklist');
        return !!roleId && member.roles.cache.has(roleId);
    },
    isVerified: (member) => {
        const roleId = roleConfig.getRoleIdSync('verified');
        return !!roleId && member.roles.cache.has(roleId);
    },
    hasPriority: (member) => {
        return ['booster', 'vip'].some(key => {
            const roleId = roleConfig.getRoleIdSync(key);
            return !!roleId && member.roles.cache.has(roleId);
        });
    }
};
