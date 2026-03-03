const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'credits.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offline_amount INTEGER DEFAULT 0,
    online_amount INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    offline_credits INTEGER DEFAULT 0,
    online_credits INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS keys (
    key_code TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('offline', 'online')),
    amount INTEGER,
    used BOOLEAN DEFAULT 0,
    used_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO stock (id, offline_amount, online_amount) VALUES (1, 0, 0);
`);

console.log('✅ Database initialized');

module.exports = db;
