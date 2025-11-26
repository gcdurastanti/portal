const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const db = new Database('./server/portal.db');

const userId = 'd19271e8-4b38-47a6-b4b4-73e27b0876c8'; // The user found in the DB
const groupId = uuidv4();
const name = 'Test Group';

try {
    console.log('Creating group...');
    const stmt = db.prepare('INSERT INTO groups (id, name, owner_user_id) VALUES (?, ?, ?)');
    stmt.run(groupId, name, userId);
    console.log('Group created.');

    console.log('Adding member...');
    const membershipId = uuidv4();
    const stmt2 = db.prepare(`
    INSERT INTO group_memberships (id, group_id, user_id, role)
    VALUES (?, ?, ?, ?)
  `);
    stmt2.run(membershipId, groupId, userId, 'owner');
    console.log('Member added.');

} catch (error) {
    console.error('Error:', error);
}
