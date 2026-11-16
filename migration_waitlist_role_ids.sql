    -- Seed existing Waitlist, Restricted, and Registration role IDs into kairo_role_configs.
    -- Run this in Supabase SQL editor or via psql. Safe to rerun (upserts by role_key).

    insert into public.kairo_role_configs (role_key, role_name, category, gamemode, tier, role_id, updated_at)
    values
        ('restricted', 'Restricted', 'Restricted', null, null, '1571874866745966612', now()),
        ('registration', 'Registration', 'Registration', null, null, '1571879625481519216', now()),
        ('waitlist_Sword', 'Sword Waitlist', 'Waitlist', 'Sword', null, '1571879629197807776', now()),
        ('waitlist_Mace', 'Mace Waitlist', 'Waitlist', 'Mace', null, '1571882966450311208', now()),
        ('waitlist_Axe', 'Axe Waitlist', 'Waitlist', 'Axe', null, '1571883033047605248', now()),
        ('waitlist_SMP', 'SMP Waitlist', 'Waitlist', 'SMP', null, '1571883119328497776', now()),
        ('waitlist_UHC', 'UHC Waitlist', 'Waitlist', 'UHC', null, '1571883173803986974', now()),
        ('waitlist_DiaPot', 'DiaPot Waitlist', 'Waitlist', 'DiaPot', null, '1571883286769438790', now()),
        ('waitlist_diasmp', 'DiaSMP Waitlist', 'Waitlist', 'diasmp', null, '1571883233107378186', now()),
        ('waitlist_spearmace', 'SpearMace Waitlist', 'Waitlist', 'spearmace', null, '1571883342209613884', now()),
        ('waitlist_manhunt', 'Manhunt Waitlist', 'Waitlist', 'manhunt', null, '1571883533570416810', now()),
        ('waitlist_cart', 'Cart Waitlist', 'Waitlist', 'cart', null, '1571883625039798403', now())
    on conflict (role_key) do update set
        role_name = excluded.role_name,
        category = excluded.category,
        gamemode = excluded.gamemode,
        tier = excluded.tier,
        role_id = excluded.role_id,
        updated_at = now();