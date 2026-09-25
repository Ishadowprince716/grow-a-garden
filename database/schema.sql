-- Grow-a-Garden Pro — schema
-- Applied automatically by backend/server.js on startup (better-sqlite3).
-- This file is source-of-truth documentation.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 20,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  basket TEXT NOT NULL DEFAULT '[]',
  unlocked INTEGER NOT NULL DEFAULT 8,
  seed_sel TEXT NOT NULL DEFAULT 'carrot',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS plots (
  player_id TEXT NOT NULL REFERENCES players(id),
  idx INTEGER NOT NULL,
  type TEXT,
  planted_at INTEGER,
  watered INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_plots_player ON plots(player_id);
