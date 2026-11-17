-- Starting Toolkit: purchase activation and password recovery
-- Run once against the existing startingtoolkit-db D1 database.
CREATE TABLE IF NOT EXISTS purchase_access_tokens (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE,
  buyer_email TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt',
  token_hash TEXT NOT NULL,
  license_id TEXT,
  purchase_status TEXT NOT NULL DEFAULT 'approved',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  email_sent_at TEXT,
  activation_claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_purchase_access_tokens_email ON purchase_access_tokens(buyer_email);
CREATE INDEX IF NOT EXISTS idx_purchase_access_tokens_expiry ON purchase_access_tokens(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS hotmart_webhook_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  transaction_id TEXT,
  event_type TEXT NOT NULL,
  buyer_email TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hotmart_events_transaction ON hotmart_webhook_events(transaction_id);
