-- Fix invite-code generation on hosted Supabase.
-- Supabase installs pgcrypto in the `extensions` schema, while create_pair()
-- deliberately uses `search_path = public`. Qualify gen_random_bytes so the
-- function can always be resolved from that security-definer context.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.random_invite_code()
returns text
language plpgsql
volatile
set search_path = pg_catalog, public, extensions
as $$
declare
  -- Omit easily confused characters: I, O, 0 and 1.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea := extensions.gen_random_bytes(8);
  invite_code text := '';
  byte_index integer;
begin
  for byte_index in 0..7 loop
    invite_code := invite_code || substr(
      alphabet,
      (get_byte(random_bytes, byte_index) % char_length(alphabet)) + 1,
      1
    );
  end loop;

  return invite_code;
end
$$;

-- Keep this helper internal. Pair creation remains available only through
-- public.create_pair(), whose authenticated-only grant was set in migration 001.
revoke all on function public.random_invite_code() from public;

-- Safe smoke test: returns an 8-character code without inserting any data.
select public.random_invite_code() as generated_invite_code;
