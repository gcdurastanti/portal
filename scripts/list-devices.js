#!/usr/bin/env node

/**
 * Script to list all devices in the database
 * Usage: node scripts/list-devices.js [group-id]
 */

const Database = require('better-sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const groupId = args[0];

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../server/portal.db');

const db = new Database(dbPath);

if (groupId) {
  console.log(`\nDevices in group: ${groupId}`);
  console.log('─'.repeat(60));

  const stmt = db.prepare(`
    SELECT d.id, d.name, d.created_at
    FROM devices d
    WHERE d.group_id = ?
    ORDER BY d.created_at DESC
  `);

  const devices = stmt.all(groupId);

  if (devices.length === 0) {
    console.log('No devices found in this group.');
  } else {
    devices.forEach(device => {
      console.log(`\nDevice ID: ${device.id}`);
      console.log(`Name: ${device.name}`);
      console.log(`Created: ${device.created_at}`);
    });
  }
} else {
  console.log('\nAll Groups and Devices');
  console.log('═'.repeat(60));

  const groups = db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();

  if (groups.length === 0) {
    console.log('No groups found. Use init-group.js to create one.');
  } else {
    groups.forEach(group => {
      console.log(`\nGroup: ${group.name} (${group.id})`);
      console.log('─'.repeat(60));

      const devices = db.prepare(`
        SELECT * FROM devices WHERE group_id = ? ORDER BY created_at DESC
      `).all(group.id);

      if (devices.length === 0) {
        console.log('  No devices yet');
      } else {
        devices.forEach(device => {
          console.log(`  • ${device.name} (${device.id})`);
          console.log(`    Created: ${device.created_at}`);
        });
      }
    });
  }
}

db.close();
