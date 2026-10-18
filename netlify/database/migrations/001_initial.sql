CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member','reseller','admin','owner','developer')),
  created DOUBLE PRECISION NOT NULL,
  CHECK (username = lower(username))
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (lower(username));
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  expires DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires);
CREATE TABLE IF NOT EXISTS recovery_codes (
  username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  created DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS limits (
  bucket TEXT NOT NULL,
  ident TEXT NOT NULL,
  window_start DOUBLE PRECISION NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY(bucket, ident)
);
CREATE INDEX IF NOT EXISTS limits_window_idx ON limits(window_start);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  at TEXT NOT NULL
);
INSERT INTO settings(key,value) VALUES ('notice',''),('maintenance','false'),('siteName','XyroPlay') ON CONFLICT (key) DO NOTHING;
