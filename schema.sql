-- Extends the existing packages + vulnerabilities tables
-- Run in Supabase SQL editor

-- -----------------------------------------------------------------------
-- packages
-- -----------------------------------------------------------------------
alter table packages
  add column if not exists name        text        not null default '',
  add column if not exists ecosystem   text        not null default '',  -- npm | PyPI
  add column if not exists description text,
  add column if not exists homepage    text,
  add column if not exists repository  text,
  add column if not exists latest_version text,
  add column if not exists updated_at  timestamptz default now();

-- Unique constraint so upserts work on (name, ecosystem)
alter table packages
  drop constraint if exists packages_name_ecosystem_key;
alter table packages
  add constraint packages_name_ecosystem_key unique (name, ecosystem);

create index if not exists idx_packages_ecosystem on packages (ecosystem);
create index if not exists idx_packages_name      on packages (name);

-- -----------------------------------------------------------------------
-- vulnerabilities
-- -----------------------------------------------------------------------
alter table vulnerabilities
  add column if not exists cve_id       text unique,          -- CVE-2024-xxxxx
  add column if not exists ghsa_id      text unique,          -- GHSA-xxxx-xxxx-xxxx
  add column if not exists osv_id       text unique,          -- OSV / GHSA id from OSV.dev
  add column if not exists summary      text,
  add column if not exists description  text,
  add column if not exists cvss_score   numeric(4,1),
  add column if not exists cvss_vector  text,
  add column if not exists cvss_severity text,                -- LOW | MEDIUM | HIGH | CRITICAL
  add column if not exists ecosystem    text,                 -- npm | PyPI
  add column if not exists affected_packages jsonb,           -- [{name, ecosystem, versions[]}]
  add column if not exists cpe_list     text[],
  add column if not exists published_at timestamptz,
  add column if not exists modified_at  timestamptz,
  add column if not exists source       text,                 -- nvd | osv
  add column if not exists epss_score   numeric(7,6),         -- 0.0–1.0 from FIRST EPSS API
  add column if not exists epss_percentile numeric(7,6),
  add column if not exists in_kev       boolean default false, -- CISA Known Exploited Vulnerabilities
  add column if not exists combined_risk_score numeric(5,2);  -- 0–100 proprietary score

create index if not exists idx_vuln_cve_id    on vulnerabilities (cve_id);
create index if not exists idx_vuln_ghsa_id   on vulnerabilities (ghsa_id);
create index if not exists idx_vuln_severity  on vulnerabilities (cvss_severity);
create index if not exists idx_vuln_ecosystem on vulnerabilities (ecosystem);
create index if not exists idx_vuln_published on vulnerabilities (published_at desc);

-- -----------------------------------------------------------------------
-- package_vulnerabilities  (join table)
-- -----------------------------------------------------------------------
create table if not exists package_vulnerabilities (
  id                bigint generated always as identity primary key,
  package_id        bigint references packages(id) on delete cascade,
  vulnerability_id  bigint references vulnerabilities(id) on delete cascade,
  introduced_version text,
  fixed_version      text,
  created_at        timestamptz default now(),
  unique (package_id, vulnerability_id)
);

create index if not exists idx_pkgvuln_package on package_vulnerabilities (package_id);
create index if not exists idx_pkgvuln_vuln    on package_vulnerabilities (vulnerability_id);

-- -----------------------------------------------------------------------
-- github_usage  (tracks monthly check usage per GitHub App installation)
-- -----------------------------------------------------------------------
create table if not exists github_usage (
  id              bigint generated always as identity primary key,
  installation_id bigint      not null,
  repo            text        not null,
  pr_number       int         not null,
  created_at      timestamptz default now()
);

create index if not exists idx_github_usage_installation on github_usage (installation_id, created_at desc);
