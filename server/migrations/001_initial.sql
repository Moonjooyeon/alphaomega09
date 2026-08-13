CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  login_id text UNIQUE,
  password_hash text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id text PRIMARY KEY,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'app_store',
  provider_order_id text,
  provider_transaction_id text,
  product_id text,
  amount_krw integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KRW',
  status text NOT NULL DEFAULT 'created',
  purchaser_email text,
  purchaser_name text,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  UNIQUE (provider, provider_order_id),
  UNIQUE (provider, provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS access_passes (
  id text PRIMARY KEY,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  order_id text REFERENCES purchase_orders(id) ON DELETE SET NULL,
  pass_code text UNIQUE,
  status text NOT NULL DEFAULT 'available',
  allowed_uses integer NOT NULL DEFAULT 5,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz,
  canceled_at timestamptz
);

CREATE TABLE IF NOT EXISTS usage_sessions (
  id text PRIMARY KEY,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  access_pass_id text REFERENCES access_passes(id) ON DELETE SET NULL,
  key_mode text NOT NULL DEFAULT 'shared',
  report_mode text NOT NULL DEFAULT 'pair',
  status text NOT NULL DEFAULT 'started',
  gemini_request_count integer NOT NULL DEFAULT 0,
  successful_request_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS access_pass_charges (
  id text PRIMARY KEY,
  access_pass_id text NOT NULL REFERENCES access_passes(id) ON DELETE CASCADE,
  session_id text REFERENCES usage_sessions(id) ON DELETE SET NULL,
  charge_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'consumed',
  reason text NOT NULL DEFAULT 'report_completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz
);

CREATE TABLE IF NOT EXISTS gemini_requests (
  id text PRIMARY KEY,
  session_id text REFERENCES usage_sessions(id) ON DELETE SET NULL,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  access_pass_id text REFERENCES access_passes(id) ON DELETE SET NULL,
  key_mode text NOT NULL DEFAULT 'shared',
  requested_model text NOT NULL,
  actual_model text NOT NULL,
  phase text NOT NULL DEFAULT 'generate',
  ok boolean NOT NULL DEFAULT false,
  status integer NOT NULL DEFAULT 0,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(14, 8) NOT NULL DEFAULT 0,
  cost_krw numeric(14, 4) NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_passes_status ON access_passes(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_provider ON purchase_orders(provider, status);
CREATE INDEX IF NOT EXISTS idx_access_pass_charges_pass_id ON access_pass_charges(access_pass_id);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_user_id ON usage_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_gemini_requests_created_at ON gemini_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_gemini_requests_session_id ON gemini_requests(session_id);
