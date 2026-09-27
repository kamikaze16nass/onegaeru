-- Apply and commit before 004 (PostgreSQL enum values need a commit before use).
alter type public.kp_transaction_kind add value if not exists 'pyon_reward';
