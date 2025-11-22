#!/usr/bin/env node

/**
 * Script to initialize a group in the database
 * Usage: node scripts/init-group.js <group-id> <group-name>
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node scripts/init-group.js <group-id> <group-name>');
  console.log('Example: node scripts/init-group.js smith-family "Smith Family"');
  process.exit(1);
}

const [groupId, groupName] = args;
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../server/portal.db');

console.log(`Initializing group in database: ${dbPath}`);

const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )
`);

try {
  const stmt = db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)');
  stmt.run(groupId, groupName);
  console.log(`✓ Group created: ${groupId} - "${groupName}"`);
  console.log(`\nAdd this to your .env files:`);
  console.log(`VITE_GROUP_ID=${groupId}`);
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    console.log(`✓ Group already exists: ${groupId}`);
  } else {
    console.error('Error creating group:', error.message);
    process.exit(1);
  }
}

db.close();
