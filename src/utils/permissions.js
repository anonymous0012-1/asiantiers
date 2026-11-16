const roleConfig = require('./roleConfig');

function debugAuth(commandName, requiredKey, requiredRoleId, member, allowed) {
    console.log('[AuthDebug]', commandName, {
        requiredKey,
        requiredRoleId,
        userRoleIds: member?.roles?.cache ? [...member.roles.cache.keys()] : [],
        allowed
    });
}

module.exports = {
    isTester: (member) => {
        const requiredRoleId = roleConfig.getRoleIdSync('tester');
        const allowed = !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        if (!allowed) debugAuth('isTester', 'tester', requiredRoleId, member, allowed);
        return allowed;
    },
    isBlacklisted: (member) => {
        const requiredRoleId = roleConfig.getRoleIdSync('blacklist');
        const allowed = !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        if (allowed) debugAuth('isBlacklisted', 'blacklist', requiredRoleId, member, allowed);
        return allowed;
    },
    isVerified: (member) => {
        const requiredRoleId = roleConfig.getRoleIdSync('verified');
        const allowed = !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        if (!allowed) debugAuth('isVerified', 'verified', requiredRoleId, member, allowed);
        return allowed;
    },
    hasPriority: (member) => {
        const keys = ['booster', 'vip'];
        const allowed = keys.some(key => {
            const requiredRoleId = roleConfig.getRoleIdSync(key);
            return !!requiredRoleId && member.roles.cache.has(requiredRoleId);
        });
        if (!allowed) debugAuth('hasPriority', keys.join(','), keys.map(k => roleConfig.getRoleIdSync(k)), member, allowed);
        return allowed;
    }
};
