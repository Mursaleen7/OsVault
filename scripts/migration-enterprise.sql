-- OsVault Enterprise Schema Migration
-- Adds: organizations, subscriptions, audit_logs, and RBAC tables
-- Run in Supabase SQL editor

-- -----------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  github_org_id   bigint UNIQUE,       -- GitHub org ID for linking
  plan            text NOT NULL DEFAULT 'free',  -- free | team | enterprise
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,
  seat_count      int NOT NULL DEFAULT 1,
  max_seats       int NOT NULL DEFAULT 1,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_org_github ON organizations (github_org_id);
CREATE INDEX IF NOT EXISTS idx_org_stripe ON organizations (stripe_customer_id);

-- -----------------------------------------------------------------------
-- organization_members  (RBAC: Admin, Security Engineer, Viewer)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_members (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email      text NOT NULL,
  github_username text,
  role            text NOT NULL DEFAULT 'viewer',  -- admin | security_engineer | viewer
  invited_at      timestamptz DEFAULT now(),
  accepted_at     timestamptz,
  UNIQUE (organization_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_orgmember_org ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_orgmember_email ON organization_members (user_email);

-- -----------------------------------------------------------------------
-- subscriptions  (Stripe billing tracking)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id        bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_price_id        text NOT NULL,
  status                 text NOT NULL DEFAULT 'active',  -- active | past_due | canceled | trialing
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at              timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_org ON subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions (status);

-- -----------------------------------------------------------------------
-- audit_logs  (Immutable, append-only)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint REFERENCES organizations(id) ON DELETE SET NULL,
  actor_email     text NOT NULL,
  action          text NOT NULL,         -- e.g. 'cve.ignored', 'jira.created', 'member.invited', 'scan.triggered'
  resource_type   text,                  -- e.g. 'cve', 'pr', 'member', 'integration'
  resource_id     text,                  -- e.g. 'CVE-2024-38816', 'PR#423'
  metadata        jsonb DEFAULT '{}',   -- Additional context
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);

-- Audit logs should NEVER be deleted
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_email, created_at DESC);

-- Prevent UPDATE and DELETE on audit_logs (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are not permitted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_update ON audit_logs;
CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_mutation();

-- -----------------------------------------------------------------------
-- integration_configs  (Slack, Jira, PagerDuty settings per org)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_configs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text NOT NULL,         -- slack | jira | pagerduty
  enabled         boolean DEFAULT false,
  config          jsonb DEFAULT '{}',   -- Provider-specific config (webhook URL, project key, etc.)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_intg_org ON integration_configs (organization_id);

-- -----------------------------------------------------------------------
-- scan_results  (Historical scan data for dashboard analytics)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_results (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id   bigint REFERENCES organizations(id) ON DELETE CASCADE,
  repo              text NOT NULL,
  pr_number         int,
  head_sha          text,
  total_packages    int NOT NULL DEFAULT 0,
  total_vulns       int NOT NULL DEFAULT 0,
  reachable_vulns   int NOT NULL DEFAULT 0,
  bypassed_vulns    int NOT NULL DEFAULT 0,
  critical_count    int NOT NULL DEFAULT 0,
  high_count        int NOT NULL DEFAULT 0,
  conclusion        text,                -- success | failure
  scan_duration_ms  int,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_org ON scan_results (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_repo ON scan_results (repo, created_at DESC);
