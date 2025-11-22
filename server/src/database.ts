import Database from 'better-sqlite3';
import { Group, Device } from '@portal/shared';

export class PortalDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Groups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Devices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id)
      )
    `);
  }

  // Group operations
  createGroup(id: string, name: string): void {
    const stmt = this.db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)');
    stmt.run(id, name);
  }

  getGroup(id: string): Group | null {
    const stmt = this.db.prepare('SELECT * FROM groups WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    const devices = this.getDevicesByGroup(id);
    return {
      id: row.id,
      name: row.name,
      deviceIds: devices.map(d => d.id)
    };
  }

  // Device operations
  createDevice(id: string, groupId: string, name: string): void {
    const stmt = this.db.prepare('INSERT INTO devices (id, group_id, name) VALUES (?, ?, ?)');
    stmt.run(id, groupId, name);
  }

  getDevice(id: string): { id: string; groupId: string; name: string } | null {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      groupId: row.group_id,
      name: row.name
    };
  }

  getDevicesByGroup(groupId: string): { id: string; groupId: string; name: string }[] {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE group_id = ?');
    const rows = stmt.all(groupId) as any[];

    return rows.map(row => ({
      id: row.id,
      groupId: row.group_id,
      name: row.name
    }));
  }

  deviceExists(id: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM devices WHERE id = ?');
    const result = stmt.get(id) as { count: number };
    return result.count > 0;
  }

  close() {
    this.db.close();
  }
}
