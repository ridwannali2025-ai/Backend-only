-- Phase 4F: AI Request Logs Table
-- Logs all API requests for debugging, latency tracking, and cost analysis

CREATE TABLE IF NOT EXISTS ai_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  route text NOT NULL,
  user_id text NULL,
  environment text NULL,
  model_used text NULL,
  tokens_in int NULL,
  tokens_out int NULL,
  cost_estimate_usd numeric NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error', 'rate_limited', 'guardrail_block', 'bad_request')),
  http_status int NOT NULL,
  latency_ms int NOT NULL,
  error_code text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created_at ON ai_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_id_created_at ON ai_request_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_route_created_at ON ai_request_logs(route, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_request_id ON ai_request_logs(request_id);

-- Enable RLS
ALTER TABLE ai_request_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service-role can insert (server-side only)
-- No select policy needed for now (service-role only access)
CREATE POLICY "Service role can insert logs"
  ON ai_request_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

