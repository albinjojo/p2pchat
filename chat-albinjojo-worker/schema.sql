/*CREATE TABLE IF NOT EXISTS rooms (
  slug TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);*/

CREATE TABLE IF NOT EXISTS admin (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);