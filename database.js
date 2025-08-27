const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve('analytics.db'), { verbose: console.log });

//Create Table
function setupDatabase() {
  const createTableStmt = db.prepare(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      column_count INTEGER NOT NULL,
      upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  createTableStmt.run();
  console.log('Database table "files" is ready.');
}
setupDatabase();
module.exports = db;