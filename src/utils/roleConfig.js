// Centralized role configuration loaded from Supabase `kairo_role_configs`.
const supabase = require('../database/supabase');

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000;

async function loadRoleConfigs(force = false, guildId = null) {
    const now = Date.now();
    if (!force && cache && (now - cacheTime) < CACHE_TTL) {
        return cache;
    }

    const { data, error } = await supabase
        .from('kairo_role_configs')
        .select('role_key, role_name, role_category, gamemode, tier, role_id');

    if (error) {
        throw error;
    }

    const map = {};
    for (const row of data || []) {
        if (row?.role_key && row?.role_id) {
            map[row.role_key] = row.role_id;
        }
    }

    cache = map;
    cacheTime = now;
    return map;
}

function getRoleConfigsSync() {
    return cache || {};
}

function getRoleIdSync(roleKey) {
    if (!roleKey) return null;
    return (cache || {})[roleKey] || null;
}

async function getRoleId(roleKey, guildId = null, force = false) {
    await loadRoleConfigs(force, guildId);
    return getRoleIdSync(roleKey);
}

function getTierRoleIdsSync(gamemode) {
    const prefix = `tier_${gamemode}_`;
    const result = [];
    for (const [key, id] of Object.entries(cache || {})) {
        if (key.startsWith(prefix)) result.push(id);
    }
    return result;
}

function getGamemodeTesterRoleIdSync(gamemode) {
    return getRoleIdSync(`tester_gamemode_${gamemode}`);
}

async function getTierRoleIds(gamemode, guildId = null, force = false) {
    await loadRoleConfigs(force, guildId);
    return getTierRoleIdsSync(gamemode);
}

async function getGamemodeTesterRoleId(gamemode, guildId = null, force = false) {
    await loadRoleConfigs(force, guildId);
    return getGamemodeTesterRoleIdSync(gamemode);
}

function hasRoleSync(member, roleKey) {
    const roleId = getRoleIdSync(roleKey);
    if (!roleId || !member?.roles?.cache) return false;
    return member.roles.cache.has(roleId);
}

async function hasRole(member, roleKey, guildId = null, force = false) {
    await loadRoleConfigs(force, guildId);
    return hasRoleSync(member, roleKey);
}

async function upsertRoleConfig(roleKey, roleName, category, gamemode, tier, roleId, guildId = null) {
    const { error } = await supabase
        .from('kairo_role_configs')
        .upsert({
            role_key: roleKey,
            role_name: roleName,
            role_category: category,
            gamemode: gamemode || null,
            tier: tier || null,
            role_id: roleId,
            updated_at: new Date().toISOString()
        }, { onConflict: 'role_key' });

    if (error) throw error;
    cache = null;
    cacheTime = 0;
}

async function deleteRoleConfigs(roleKeys) {
    if (!roleKeys || roleKeys.length === 0) return;
    const { error } = await supabase
        .from('kairo_role_configs')
        .delete()
        .in('role_key', roleKeys);

    if (error) throw error;
    cache = null;
    cacheTime = 0;
}

function clearRoleConfigCache() {
    cache = null;
    cacheTime = 0;
}

module.exports = {
    loadRoleConfigs,
    getRoleConfigsSync,
    getRoleIdSync,
    getRoleId,
    getTierRoleIdsSync,
    getTierRoleIds,
    getGamemodeTesterRoleIdSync,
    getGamemodeTesterRoleId,
    hasRoleSync,
    hasRole,
    upsertRoleConfig,
    deleteRoleConfigs,
    clearRoleConfigCache
};
