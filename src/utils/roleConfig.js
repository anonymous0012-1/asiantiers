// Centralized role ID lookup with simple in-memory caching.
const supabase = require('../database/supabase');

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000;

async function loadRoleConfigs(force = false) {
    const now = Date.now();
    if (!force && cache && (now - cacheTime) < CACHE_TTL) {
        return cache;
    }

    const { data, error } = await supabase
        .from('kairo_role_configs')
        .select('role_key, role_id');

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

async function getRoleId(roleKey, force = false) {
    const configs = await loadRoleConfigs(force);
    return configs?.[roleKey] || null;
}

function clearRoleConfigCache() {
    cache = null;
    cacheTime = 0;
}

async function upsertRoleConfig(roleKey, roleName, category, gamemode, tier, roleId) {
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
    clearRoleConfigCache();
}

async function deleteRoleConfigs(roleKeys) {
    if (!roleKeys || roleKeys.length === 0) return;
    const { error } = await supabase
        .from('kairo_role_configs')
        .delete()
        .in('role_key', roleKeys);

    if (error) throw error;
    clearRoleConfigCache();
}

async function getAllRoleConfigs(force = false) {
    return loadRoleConfigs(force);
}

module.exports = {
    loadRoleConfigs,
    getRoleId,
    clearRoleConfigCache,
    upsertRoleConfig,
    deleteRoleConfigs,
    getAllRoleConfigs
};
