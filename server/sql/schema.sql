CREATE TABLE IF NOT EXISTS image_jobs (
  id UUID PRIMARY KEY,
  original_filename TEXT,
  status TEXT NOT NULL,
  original_path TEXT NOT NULL,
  processed_path TEXT,
  error TEXT,
  target_dimension INT NOT NULL DEFAULT 1024,
  original_size_bytes BIGINT,
  processed_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
