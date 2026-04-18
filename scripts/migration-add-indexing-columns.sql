-- Migration: Add Google Indexing tracking columns to vulnerabilities table
-- Run this in your Supabase SQL Editor

-- Add indexing tracking columns
ALTER TABLE vulnerabilities
  ADD COLUMN IF NOT EXISTS google_indexed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_index_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS google_index_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS google_last_attempt_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vuln_index_status ON vulnerabilities (google_index_status);
CREATE INDEX IF NOT EXISTS idx_vuln_indexed_at ON vulnerabilities (google_indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vuln_last_attempt ON vulnerabilities (google_last_attempt_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN vulnerabilities.google_indexed_at IS 'Timestamp when successfully indexed in Google';
COMMENT ON COLUMN vulnerabilities.google_index_status IS 'Indexing status: pending | indexed | failed';
COMMENT ON COLUMN vulnerabilities.google_index_attempts IS 'Number of indexing attempts made';
COMMENT ON COLUMN vulnerabilities.google_last_attempt_at IS 'Last indexing attempt timestamp';

-- Optional: Create a view for indexing statistics
CREATE OR REPLACE VIEW indexing_stats AS
SELECT
  google_index_status,
  COUNT(*) as count,
  MAX(google_indexed_at) as last_indexed,
  MAX(google_last_attempt_at) as last_attempt
FROM vulnerabilities
GROUP BY google_index_status;

COMMENT ON VIEW indexing_stats IS 'Summary statistics for Google indexing status';
