---
description: User Authentication & Family Group Management Implementation Plan
---

# User Authentication & Family Group Management
## Implementation Plan for Portal Application

---

## 🎯 Overview

Transform the Portal application from device-based to user-based authentication with family group management. This plan covers user registration, authentication, and multi-device family group coordination.

### Current State
- ✅ Devices automatically join groups using `VITE_GROUP_ID`
- ✅ No user accounts or authentication
- ✅ Devices are tied directly to groups
- ✅ Basic presence detection and conferencing

### Target State
- 🎯 User accounts with email/password authentication
- 🎯 Users can create and manage family groups
- 🎯 Users can invite family members to groups
- 🎯 Devices are associated with users, not groups directly
- 🎯 Multiple devices per user supported
- 🎯 Proper session management and security

---

## 📋 Phase 1: Database Schema & Backend Foundation

### 1.1 Database Schema Changes

**New Tables:**

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- UUID
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,      -- bcrypt hash
  display_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for JWT alternative or session tokens)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- Session token
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Group memberships (many-to-many: users to groups)
CREATE TABLE group_memberships (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',       -- 'owner', 'admin', 'member'
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(group_id, user_id)
);

-- Invitations table
CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  invited_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,       -- Invitation token
  status TEXT DEFAULT 'pending',    -- 'pending', 'accepted', 'expired'
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Modified Tables:**

```sql
-- Update groups table to add owner
ALTER TABLE groups ADD COLUMN owner_user_id TEXT REFERENCES users(id);

-- Update devices table to associate with users
ALTER TABLE devices ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE devices ADD COLUMN is_active BOOLEAN DEFAULT 1;
```

### 1.2 Backend Dependencies

**Install required packages:**
```bash
cd server
npm install bcrypt jsonwebtoken uuid
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

### 1.3 New Backend Files Structure

```
server/src/
├── auth/
│   ├── auth-service.ts          # Authentication logic
│   ├── password-utils.ts        # Password hashing/verification
│   └── session-manager.ts       # Session/JWT management
├── models/
│   ├── user.ts                  # User model & types
│   ├── group.ts                 # Enhanced group model
│   └── invitation.ts            # Invitation model
├── routes/
│   ├── auth-routes.ts           # /api/auth endpoints
│   ├── user-routes.ts           # /api/users endpoints
│   └── group-routes.ts          # /api/groups endpoints
├── middleware/
│   ├── auth-middleware.ts       # JWT verification middleware
│   └── error-handler.ts         # Error handling middleware
└── database.ts                  # Enhanced with new tables
```

---

## 📋 Phase 2: API Endpoints

### 2.1 Authentication Endpoints

**POST /api/auth/register**
```typescript
Request:
{
  email: string;
  password: string;
  displayName: string;
}

Response:
{
  success: true;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  token: string;
}
```

**POST /api/auth/login**
```typescript
Request:
{
  email: string;
  password: string;
}

Response:
{
  success: true;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  token: string;
  groups: Group[];  // User's groups
}
```

**POST /api/auth/logout**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: true;
}
```

**GET /api/auth/me**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  groups: Group[];
}
```

### 2.2 Group Management Endpoints

**POST /api/groups**
```typescript
Headers: Authorization: Bearer <token>

Request:
{
  name: string;
}

Response:
{
  group: {
    id: string;
    name: string;
    ownerUserId: string;
    members: User[];
    devices: Device[];
  };
}
```

**GET /api/groups/:groupId**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  group: {
    id: string;
    name: string;
    ownerUserId: string;
    members: User[];
    devices: Device[];
  };
}
```

**POST /api/groups/:groupId/invite**
```typescript
Headers: Authorization: Bearer <token>

Request:
{
  email: string;
}

Response:
{
  invitation: {
    id: string;
    email: string;
    token: string;
    expiresAt: string;
  };
}
```

**POST /api/groups/accept-invite/:token**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: true;
  group: Group;
}
```

**DELETE /api/groups/:groupId/members/:userId**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: true;
}
```

### 2.3 Device Management Endpoints

**POST /api/devices**
```typescript
Headers: Authorization: Bearer <token>

Request:
{
  name: string;
  groupId: string;
}

Response:
{
  device: {
    id: string;
    name: string;
    userId: string;
    groupId: string;
  };
}
```

**GET /api/users/me/devices**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  devices: Device[];
}
```

**DELETE /api/devices/:deviceId**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: true;
}
```

---

## 📋 Phase 3: Frontend Integration

### 3.1 New Frontend Files Structure

```
client/src/
├── contexts/
│   └── AuthContext.tsx           # Auth state management
├── pages/
│   ├── LoginPage.tsx            # Login screen
│   ├── RegisterPage.tsx         # Registration screen
│   ├── DashboardPage.tsx        # User dashboard
│   ├── GroupsPage.tsx           # Manage groups
│   └── DevicesPage.tsx          # Manage devices
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ProtectedRoute.tsx
│   ├── groups/
│   │   ├── GroupList.tsx
│   │   ├── CreateGroupModal.tsx
│   │   ├── InviteMemberModal.tsx
│   │   └── GroupSettings.tsx
│   └── devices/
│       ├── DeviceList.tsx
│       └── DeviceSetupWizard.tsx
├── hooks/
│   ├── useAuth.ts               # Authentication hook
│   └── useGroups.ts             # Group management hook
└── api/
    ├── auth-api.ts              # Auth API calls
    ├── groups-api.ts            # Groups API calls
    └── devices-api.ts           # Devices API calls
```

### 3.2 Authentication Flow

**First-Time User Journey:**
1. User visits app → sees Login/Register screen
2. User registers with email/password → creates account
3. User creates first family group → becomes group owner
4. User sets up first device → device links to user + group
5. User invites family members → sends invitation emails
6. Family members join group → can add their own devices

**Returning User Journey:**
1. User visits app → sees Login screen
2. User logs in → sees dashboard with groups
3. User selects active group → client connects to signaling server
4. Portal works as before with presence detection

### 3.3 Device Setup Flow

**New Device Setup:**
1. User logs in on new device
2. User selects/creates a group
3. User names the device (e.g., "Kitchen Portal", "Living Room Portal")
4. Device ID is generated and associated with user + group
5. Device is ready to use

### 3.4 Storage Strategy

**LocalStorage:**
```typescript
- auth_token: string           // JWT token
- current_user: User           // User info
- active_group_id: string      // Currently selected group
- device_id: string            // Device ID (if configured)
```

---

## 📋 Phase 4: Security Considerations

### 4.1 Password Security
- ✅ Use bcrypt with salt rounds = 10
- ✅ Minimum password length: 8 characters
- ✅ Password requirements: 1 uppercase, 1 lowercase, 1 number

### 4.2 JWT Tokens
- ✅ Expiration: 7 days
- ✅ Include: userId, email in payload
- ✅ Store securely in localStorage (or httpOnly cookies for production)

### 4.3 API Security
- ✅ Middleware to verify JWT on protected routes
- ✅ Check user permissions for group operations
- ✅ Rate limiting on auth endpoints
- ✅ HTTPS required in production

### 4.4 Invitation Security
- ✅ Tokens expire after 7 days
- ✅ Single-use tokens (marked as accepted)
- ✅ Validate user has permission to invite

---

## 📋 Phase 5: WebSocket Authentication

### 5.1 Socket.IO Authentication

**Update connection to include auth:**
```typescript
const socket = io(url, {
  auth: {
    token: localStorage.getItem('auth_token'),
    deviceId: localStorage.getItem('device_id')
  }
});
```

**Server-side verification:**
```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  try {
    const decoded = verifyJWT(token);
    socket.data.userId = decoded.userId;
    socket.data.deviceId = socket.handshake.auth.deviceId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});
```

---

## 📋 Phase 6: Migration Strategy

### 6.1 Backward Compatibility

**Option A: Hard Migration**
- Wipe existing database
- All users start fresh with registration
- Simplest approach

**Option B: Soft Migration**
- Create default user accounts for existing devices
- Email users to claim their accounts
- More complex but preserves data

### 6.2 Recommended Approach

For your current stage, **Option A (Hard Migration)** is recommended:
1. Backup current database
2. Deploy new schema
3. Existing devices will need to re-register with user accounts

---

## 📋 Phase 7: Implementation Order

### Week 1: Backend Foundation
1. ✅ Update database schema
2. ✅ Create auth service & password utils
3. ✅ Implement JWT session management
4. ✅ Create authentication endpoints
5. ✅ Write auth middleware

### Week 2: Group & Device Management
1. ✅ Implement group endpoints
2. ✅ Implement invitation system
3. ✅ Implement device endpoints
4. ✅ Update signaling server for auth
5. ✅ Test backend thoroughly

### Week 3: Frontend Auth
1. ✅ Create AuthContext
2. ✅ Build Login/Register pages
3. ✅ Build ProtectedRoute component
4. ✅ Implement API client with auth headers
5. ✅ Update routing

### Week 4: Frontend Features
1. ✅ Build Dashboard page
2. ✅ Build Groups management UI
3. ✅ Build Device setup wizard
4. ✅ Build Invitation flow
5. ✅ Polish and testing

### Week 5: Integration & Testing
1. ✅ End-to-end testing
2. ✅ Security audit
3. ✅ Performance optimization
4. ✅ Documentation
5. ✅ Deployment

---

## 📋 Phase 8: Testing Checklist

### Backend Tests
- [ ] User registration with validation
- [ ] Login with correct/incorrect credentials
- [ ] JWT token generation and verification
- [ ] Session expiration handling
- [ ] Group creation and permissions
- [ ] Invitation generation and acceptance
- [ ] Device association with user/group
- [ ] WebSocket authentication
- [ ] Unauthorized access prevention

### Frontend Tests
- [ ] Login/logout flow
- [ ] Registration flow with validation
- [ ] Protected routes redirect to login
- [ ] Token refresh on expiration
- [ ] Group creation and management
- [ ] Device setup wizard
- [ ] Invitation sending/accepting
- [ ] Multi-device support
- [ ] Presence detection still works
- [ ] Conference functionality intact

---

## 🚀 Quick Start Commands

### Backend Setup
```bash
cd server
npm install bcrypt jsonwebtoken uuid
npm install --save-dev @types/bcrypt @types/jsonwebtoken
```

### Create Migration Script
```bash
# Backup existing database
cp portal.db portal.db.backup

# Run migration (will create new script)
npm run migrate
```

### Frontend Setup
```bash
cd client
npm install react-router-dom
npm install --save-dev @types/react-router-dom
```

---

## 📝 Notes & Considerations

### Email Delivery
- **Phase 1**: Generate invitation links, copy/paste manually
- **Phase 2**: Integrate email service (SendGrid, AWS SES, etc.)

### Production Deployment
- Use environment variables for JWT secret
- Enable HTTPS
- Use httpOnly cookies instead of localStorage
- Implement refresh tokens
- Add rate limiting
- Enable CORS properly

### Future Enhancements
- Social login (Google, Apple)
- Two-factor authentication
- Device approval workflow
- Group activity logs
- User profile pictures
- Push notifications for invitations

---

## ✅ Success Criteria

- [ ] Users can register and login securely
- [ ] Users can create and name family groups
- [ ] Users can invite others via email
- [ ] Users can add multiple devices to groups
- [ ] Devices are tied to users, not just groups
- [ ] Presence detection works per-user
- [ ] Conferences work with authenticated users
- [ ] Existing device functionality unchanged
- [ ] Security best practices followed
- [ ] Clean, intuitive UI/UX

---

**Estimated Timeline:** 4-5 weeks for full implementation
**Complexity:** Medium-High
**Risk Areas:** Database migration, WebSocket auth, multi-device coordination
