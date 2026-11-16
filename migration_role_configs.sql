-- Role management table for /setuproles and /wipeallroles
CREATE TABLE IF NOT EXISTS public.kairo_role_configs (
    id bigserial PRIMARY KEY,
    role_key text NOT NULL UNIQUE,
    role_name text NOT NULL,
    category text,
    gamemode text,
    tier text,
    role_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kairo_role_configs_role_key_idx
    ON public.kairo_role_configs (role_key);
