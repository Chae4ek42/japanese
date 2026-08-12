-- Accounts, progress JSON, and login sessions (replaces Workers KV).
-- Keep each statement simple (no multiline FK blocks) for remote D1 apply.

CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL, password_salt TEXT, password_hash TEXT);

CREATE TABLE IF NOT EXISTS account_state (account_id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, updated_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, expires_at INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions (account_id);
