import Database from 'better-sqlite3';
import { Group, Device } from '@portal/shared';

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  authProvider: string;
  oauthProviderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMembership {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface Invitation {
  id: string;
  groupId: string;
  invitedByUserId: string;
  invitedEmail: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export class PortalDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        auth_provider TEXT DEFAULT 'email',
        oauth_provider_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(auth_provider, oauth_provider_id)
      )
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Groups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_user_id) REFERENCES users(id)
      )
    `);

    // Group memberships table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS group_memberships (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(group_id, user_id)
      )
    `);

    // Invitations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        invited_by_user_id TEXT NOT NULL,
        invited_email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Devices table (modified for user association)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  }

  // User operations
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, avatar_url, auth_provider, oauth_provider_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.email,
      user.passwordHash,
      user.displayName,
      user.avatarUrl,
      user.authProvider,
      user.oauthProviderId
    );
  }

  getUserByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    return row ? this.mapToUser(row) : null;
  }

  getUserById(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToUser(row) : null;
  }

  getUserByOAuthProvider(provider: string, providerId: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE auth_provider = ? AND oauth_provider_id = ?');
    const row = stmt.get(provider, providerId) as any;
    return row ? this.mapToUser(row) : null;
  }

  linkOAuthProvider(userId: string, provider: string, providerId: string, avatarUrl?: string): void {
    const stmt = this.db.prepare(`
      UPDATE users SET auth_provider = ?, oauth_provider_id = ?, avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(provider, providerId, avatarUrl, userId);
  }

  private mapToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      authProvider: row.auth_provider,
      oauthProviderId: row.oauth_provider_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // Group operations
  createGroup(id: string, name: string, ownerUserId?: string): void {
    const stmt = this.db.prepare('INSERT INTO groups (id, name, owner_user_id) VALUES (?, ?, ?)');
    stmt.run(id, name, ownerUserId || null);
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

  updateGroupOwner(groupId: string, ownerUserId: string): void {
    const stmt = this.db.prepare('UPDATE groups SET owner_user_id = ? WHERE id = ?');
    stmt.run(ownerUserId, groupId);
  }

  // Group membership operations
  addGroupMember(membership: Omit<GroupMembership, 'joinedAt'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO group_memberships (id, group_id, user_id, role)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(membership.id, membership.groupId, membership.userId, membership.role);
  }

  getUserGroups(userId: string): Group[] {
    const stmt = this.db.prepare(`
      SELECT g.* FROM groups g
      INNER JOIN group_memberships gm ON g.id = gm.group_id
      WHERE gm.user_id = ?
    `);
    const rows = stmt.all(userId) as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      deviceIds: this.getDevicesByGroup(row.id).map(d => d.id)
    }));
  }

  isUserInGroup(userId: string, groupId: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM group_memberships WHERE user_id = ? AND group_id = ?');
    const result = stmt.get(userId, groupId) as { count: number };
    return result.count > 0;
  }

  removeGroupMember(groupId: string, userId: string): void {
    const stmt = this.db.prepare('DELETE FROM group_memberships WHERE group_id = ? AND user_id = ?');
    stmt.run(groupId, userId);
  }

  // Invitation operations
  createInvitation(invitation: Omit<Invitation, 'createdAt'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO invitations (id, group_id, invited_by_user_id, invited_email, token, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      invitation.id,
      invitation.groupId,
      invitation.invitedByUserId,
      invitation.invitedEmail,
      invitation.token,
      invitation.status,
      invitation.expiresAt
    );
  }

  getInvitationByToken(token: string): Invitation | null {
    const stmt = this.db.prepare('SELECT * FROM invitations WHERE token = ?');
    const row = stmt.get(token) as any;
    if (!row) return null;

    return {
      id: row.id,
      groupId: row.group_id,
      invitedByUserId: row.invited_by_user_id,
      invitedEmail: row.invited_email,
      token: row.token,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  updateInvitationStatus(token: string, status: 'accepted' | 'expired'): void {
    const stmt = this.db.prepare('UPDATE invitations SET status = ? WHERE token = ?');
    stmt.run(status, token);
  }

  // Device operations (modified for user association)
  createDevice(id: string, groupId: string, name: string, userId?: string): void {
    const stmt = this.db.prepare('INSERT INTO devices (id, group_id, user_id, name) VALUES (?, ?, ?, ?)');
    stmt.run(id, groupId, userId || null, name);
  }

  getDevice(id: string): { id: string; groupId: string; userId: string | null; name: string } | null {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      groupId: row.group_id,
      userId: row.user_id,
      name: row.name
    };
  }

  getDevicesByGroup(groupId: string): { id: string; groupId: string; userId: string | null; name: string }[] {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE group_id = ?');
    const rows = stmt.all(groupId) as any[];

    return rows.map(row => ({
      id: row.id,
      groupId: row.group_id,
      userId: row.user_id,
      name: row.name
    }));
  }

  getDevicesByUser(userId: string): { id: string; groupId: string; userId: string | null; name: string }[] {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE user_id = ?');
    const rows = stmt.all(userId) as any[];

    return rows.map(row => ({
      id: row.id,
      groupId: row.group_id,
      userId: row.user_id,
      name: row.name
    }));
  }

  deviceExists(id: string): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM devices WHERE id = ?');
    const result = stmt.get(id) as { count: number };
    return result.count > 0;
  }

  deleteDevice(id: string): void {
    const stmt = this.db.prepare('DELETE FROM devices WHERE id = ?');
    stmt.run(id);
  }

  close() {
    this.db.close();
  }
}
