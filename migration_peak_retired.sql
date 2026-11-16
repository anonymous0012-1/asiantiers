    -- AsianTiers: Peak Tier and Retired Tier fields
    -- Safe to rerun. Does not drop or rename existing columns.

    ALTER TABLE public.players
        ADD COLUMN IF NOT EXISTS peak_tiers jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS retired_tiers jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS retired_points_by_gamemode jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS is_retired boolean NOT NULL DEFAULT false;

    -- Backfill Peak Tier from historical results (highest tier ever achieved per gamemode).
    -- Existing peak values are preserved; only missing gamemodes are filled.
    WITH tier_rank(tier, rank_value) AS (
        VALUES
            ('LT5', 1), ('HT5', 2),
            ('LT4', 3), ('HT4', 4),
            ('LT3', 5), ('HT3', 6),
            ('LT2', 7), ('HT2', 8),
            ('LT1', 9), ('HT1', 10)
    ),
    ranked_results AS (
        SELECT
            r.discord_id,
            r.gamemode,
            tr.tier AS peak_tier,
            ROW_NUMBER() OVER (
                PARTITION BY r.discord_id, r.gamemode
                ORDER BY tr.rank_value DESC, r.created_at DESC
            ) AS rn
        FROM public.results r
        JOIN tier_rank tr ON tr.tier = r.new_tier
    ),
    peaks AS (
        SELECT discord_id, gamemode, peak_tier
        FROM ranked_results
        WHERE rn = 1
    ),
    aggregated AS (
        SELECT
            discord_id,
            jsonb_object_agg(gamemode, peak_tier) AS peak_obj
        FROM peaks
        GROUP BY discord_id
    )
    UPDATE public.players p
    SET peak_tiers =
        COALESCE(a.peak_obj, '{}'::jsonb) || COALESCE(p.peak_tiers, '{}'::jsonb)
    FROM aggregated a
    WHERE p.discord_id = a.discord_id;
