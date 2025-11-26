const Database = require('better-sqlite3');
const db = new Database('./server/portal.db');

console.log('Migrating database...');

try {
    // Check if owner_user_id exists in groups
    const groupInfo = db.prepare("PRAGMA table_info(groups)").all();
    const hasOwner = groupInfo.some(col => col.name === 'owner_user_id');

    if (!hasOwner) {
        console.log('Adding owner_user_id to groups table...');
        db.exec('ALTER TABLE groups ADD COLUMN owner_user_id TEXT REFERENCES users(id)');
    } else {
        console.log('groups table already has owner_user_id');
    }

    // Check if user_id exists in devices
    const deviceInfo = db.prepare("PRAGMA table_info(devices)").all();
    const hasUser = deviceInfo.some(col => col.name === 'user_id');

    if (!hasUser) {
        console.log('Adding user_id to devices table...');
        db.exec('ALTER TABLE devices ADD COLUMN user_id TEXT REFERENCES users(id)');
    } else {
        console.log('devices table already has user_id');
    }

    // Check if is_active exists in devices
    const hasActive = deviceInfo.some(col => col.name === 'is_active');
    if (!hasActive) {
        console.log('Adding is_active to devices table...');
        db.exec('ALTER TABLE devices ADD COLUMN is_active BOOLEAN DEFAULT 1');
    }

    console.log('Migration complete.');
} catch (error) {
    console.error('Migration failed:', error);
}
