-- Speed gamemode support
-- Safe to rerun. Does not drop or rename existing columns/tables.

-- Ensure the tier role mapping table exists.
CREATE TABLE IF NOT EXISTS public.tier_roles (
    id bigserial PRIMARY KEY,
    gamemode text NOT NULL,
    tier text NOT NULL,
    role_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tier_roles_gamemode_tier_idx
    ON public.tier_roles (gamemode, tier);

-- Ensure a queue row exists for the Speed waitlist channel.
INSERT INTO public.queues (gamemode, channel_id, status)
VALUES ('Speed', '1574823201479983306', 'CLOSED')
ON CONFLICT (channel_id) DO NOTHING;

-- If queues has a unique constraint on gamemode instead, the statement above
-- still avoids duplicate channel rows. If your schema uses gamemode as the
-- conflict target, replace ON CONFLICT (channel_id) with ON CONFLICT (gamemode).