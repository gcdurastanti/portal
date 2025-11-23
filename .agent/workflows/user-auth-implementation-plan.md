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
- 🎯 Social login with Google, Facebook, and Apple
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
  password_hash TEXT,               -- bcrypt hash (NULL for OAuth users)
  display_name TEXT NOT NULL,
  avatar_url TEXT,                  -- Profile picture from OAuth
  auth_provider TEXT DEFAULT 'email', -- 'email', 'google', 'facebook', 'apple'
  oauth_provider_id TEXT,           -- Provider's user ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(auth_provider, oauth_provider_id)
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
npm install bcrypt jsonwebtoken uuid passport passport-google-oauth20 passport-facebook passport-apple
npm install --save-dev @types/bcrypt @types/jsonwebtoken @types/passport @types/passport-google-oauth20 @types/passport-facebook
```

### 1.3 New Backend Files Structure

```
server/src/
├── auth/
│   ├── auth-service.ts          # Authentication logic
│   ├── password-utils.ts        # Password hashing/verification
│   ├── session-manager.ts       # Session/JWT management
│   ├── passport-config.ts       # Passport.js configuration
│   └── oauth/
│       ├── google-strategy.ts   # Google OAuth strategy
│       ├── facebook-strategy.ts # Facebook OAuth strategy
│       └── apple-strategy.ts    # Apple OAuth strategy
├── models/
│   ├── user.ts                  # User model & types
│   ├── group.ts                 # Enhanced group model
│   └── invitation.ts            # Invitation model
├── routes/
│   ├── auth-routes.ts           # /api/auth endpoints
│   ├── oauth-routes.ts          # /api/auth/oauth endpoints
│   ├── user-routes.ts           # /api/users endpoints
│   └── group-routes.ts          # /api/groups endpoints
├── middleware/
│   ├── auth-middleware.ts       # JWT verification middleware
│   └── error-handler.ts         # Error handling middleware
└── database.ts                  # Enhanced with new tables
```

### 1.4 OAuth Provider Configuration

#### Google OAuth Setup

**1. Create Google Cloud Project:**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create new project or select existing
- Enable Google+ API

**2. Create OAuth 2.0 Credentials:**
- Navigate to APIs & Services > Credentials
- Create OAuth 2.0 Client ID
- Application type: Web application
- Authorized redirect URIs:
  ```
  http://localhost:5000/api/auth/google/callback
  https://yourdomain.com/api/auth/google/callback
  ```

**3. Environment Variables:**
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

#### Facebook OAuth Setup

**1. Create Facebook App:**
- Go to [Facebook Developers](https://developers.facebook.com/)
- Create new app > Consumer
- Add Facebook Login product

**2. Configure OAuth Settings:**
- Go to Facebook Login > Settings
- Valid OAuth Redirect URIs:
  ```
  http://localhost:5000/api/auth/facebook/callback
  https://yourdomain.com/api/auth/facebook/callback
  ```

**3. Environment Variables:**
```env
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/auth/facebook/callback
```

#### Apple Sign In Setup

**1. Create App ID:**
- Go to [Apple Developer](https://developer.apple.com/)
- Certificates, Identifiers & Profiles
- Register new App ID
- Enable Sign in with Apple

**2. Create Service ID:**
- Create Services ID
- Configure Sign in with Apple
- Return URLs:
  ```
  http://localhost:5000/api/auth/apple/callback
  https://yourdomain.com/api/auth/apple/callback
  ```

**3. Create Key:**
- Keys > Create new key
- Enable Sign in with Apple
- Download .p8 key file

**4. Environment Variables:**
```env
APPLE_CLIENT_ID=your_service_id
APPLE_TEAM_ID=your_team_id
APPLE_KEY_ID=your_key_id
APPLE_PRIVATE_KEY_PATH=path/to/key.p8
APPLE_CALLBACK_URL=http://localhost:5000/api/auth/apple/callback
```

---

## 📋 Phase 1.5: OAuth Implementation Details

### Backend OAuth Strategy (Example: Google)

**File: `server/src/auth/oauth/google-strategy.ts`**
```typescript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PortalDatabase } from '../../database';
import { v4 as uuidv4 } from 'uuid';

export function setupGoogleStrategy(db: PortalDatabase) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID
      let user = db.getUserByOAuthProvider('google', profile.id);
      
      if (!user) {
        // Check if user exists with same email
        const existingEmailUser = db.getUserByEmail(profile.emails![0].value);
        
        if (existingEmailUser) {
          // Link Google account to existing user
          db.linkOAuthProvider(
            existingEmailUser.id, 
            'google', 
            profile.id,
            profile.photos?.[0]?.value
          );
          user = existingEmailUser;
        } else {
          // Create new user
          const newUser = {
            id: uuidv4(),
            email: profile.emails![0].value,
            displayName: profile.displayName,
            authProvider: 'google',
            oauthProviderId: profile.id,
            avatarUrl: profile.photos?.[0]?.value,
            passwordHash: null
          };
          db.createUser(newUser);
          user = newUser;
        }
      }
      
      return done(null, user);
    } catch (error) {
      return done(error as Error);
    }
  }));
}
```

### Frontend Social Login Component

**File: `client/src/components/auth/SocialLoginButtons.tsx`**
```tsx
import React from 'react';

export function SocialLoginButtons() {
  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
  };

  const handleFacebookLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/facebook`;
  };

  const handleAppleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/apple`;
  };

  return (
    <div className="social-login-buttons">
      <button onClick={handleGoogleLogin} className="btn-google">
        <img src="/icons/google.svg" alt="Google" />
        Continue with Google
      </button>
      
      <button onClick={handleFacebookLogin} className="btn-facebook">
        <img src="/icons/facebook.svg" alt="Facebook" />
        Continue with Facebook
      </button>
      
      <button onClick={handleAppleLogin} className="btn-apple">
        <img src="/icons/apple.svg" alt="Apple" />
        Continue with Apple
      </button>
    </div>
  );
}
```

**File: `client/src/pages/OAuthCallbackPage.tsx`**
```tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      // Save token and redirect to dashboard
      localStorage.setItem('auth_token', token);
      login(token); // Update auth context
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="oauth-callback">
      <h2>Completing sign in...</h2>
      <p>Please wait while we log you in.</p>
    </div>
  );
}
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

### 2.1.1 OAuth Authentication Endpoints

**GET /api/auth/google**
```typescript
// Redirects to Google OAuth consent screen
// No request body needed
```

**GET /api/auth/google/callback**
```typescript
// Google redirects here after user grants permission
// Automatically exchanges code for user info

Response: (Redirects to frontend with token)
http://localhost:3000/auth/callback?token=<jwt_token>&provider=google
```

**GET /api/auth/facebook**
```typescript
// Redirects to Facebook OAuth consent screen
```

**GET /api/auth/facebook/callback**
```typescript
// Facebook redirects here after user grants permission

Response: (Redirects to frontend with token)
http://localhost:3000/auth/callback?token=<jwt_token>&provider=facebook
```

**POST /api/auth/apple**
```typescript
// Initiates Apple Sign In
// Uses different flow (POST instead of GET)
```

**POST /api/auth/apple/callback**
```typescript
// Apple redirects here after user grants permission

Response: (Redirects to frontend with token)
http://localhost:3000/auth/callback?token=<jwt_token>&provider=apple
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
│   ├── OAuthCallbackPage.tsx    # OAuth callback handler
│   ├── DashboardPage.tsx        # User dashboard
│   ├── GroupsPage.tsx           # Manage groups
│   └── DevicesPage.tsx          # Manage devices
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── SocialLoginButtons.tsx  # Google/Facebook/Apple buttons
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
- [ ] Google OAuth flow end-to-end
- [ ] Facebook OAuth flow end-to-end
- [ ] Apple OAuth flow end-to-end
- [ ] OAuth account linking with existing email
- [ ] OAuth callback error handling
- [ ] Group creation and permissions
- [ ] Invitation generation and acceptance
- [ ] Device association with user/group
- [ ] WebSocket authentication
- [ ] Unauthorized access prevention

### Frontend Tests
- [ ] Login/logout flow
- [ ] Registration flow with validation
- [ ] Google login button redirects correctly
- [ ] Facebook login button redirects correctly
- [ ] Apple login button redirects correctly
- [ ] OAuth callback page handles token correctly
- [ ] OAuth error handling and display
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
- Enable HTTPS (required for OAuth callbacks)
- Use httpOnly cookies instead of localStorage
- Implement refresh tokens
- Add rate limiting
- Enable CORS properly
- **OAuth-specific**:
  - Update OAuth redirect URLs to production domain
  - Verify all OAuth apps in production mode
  - Store OAuth credentials securely in environment
  - Test OAuth flows on production domain

### Future Enhancements
- Two-factor authentication
- Biometric authentication (Touch ID, Face ID)
- Device approval workflow
- Group activity logs
- User profile pictures (auto-populated from OAuth)
- Push notifications for invitations
- Remember device/trusted devices
- Account recovery flow
- Privacy controls for OAuth data

---

## ✅ Success Criteria

- [ ] Users can register and login securely (email/password)
- [ ] Users can login with Google, Facebook, and Apple
- [ ] OAuth accounts properly linked to existing email users
- [ ] Users can create and name family groups
- [ ] Users can invite others via email
- [ ] Users can add multiple devices to groups
- [ ] Devices are tied to users, not just groups
- [ ] Presence detection works per-user
- [ ] Conferences work with authenticated users
- [ ] Existing device functionality unchanged
- [ ] Security best practices followed
- [ ] Clean, intuitive UI/UX
- [ ] Social login buttons look premium and work smoothly

---

**Estimated Timeline:** 5-6 weeks for full implementation (including OAuth)
**Complexity:** Medium-High
**Risk Areas:** Database migration, WebSocket auth, multi-device coordination, OAuth provider setup

---

## 🔑 OAuth Quick Reference

### Environment Variables Needed
```env
# JWT
JWT_SECRET=your_random_secret_key_here

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=xxxxx
FACEBOOK_APP_SECRET=xxxxx
FACEBOOK_CALLBACK_URL=http://localhost:5000/api/auth/facebook/callback

# Apple OAuth
APPLE_CLIENT_ID=com.yourcompany.portalapp
APPLE_TEAM_ID=XXXXX
APPLE_KEY_ID=XXXXX
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXX.p8
APPLE_CALLBACK_URL=http://localhost:5000/api/auth/apple/callback
```

### Common OAuth Issues & Solutions

**Google OAuth:**
- ❌ "redirect_uri_mismatch" → Double-check callback URL matches exactly in Google Console
- ❌ "invalid_client" → Verify CLIENT_ID and CLIENT_SECRET are correct
- ✅ **Solution**: Ensure trailing slashes match and protocol is correct (http vs https)

**Facebook OAuth:**
- ❌ "Invalid redirect_uri" → Whitelist callback URL in Facebook App settings
- ❌ App not available → Make sure app is in "Live" mode for production
- ✅ **Solution**: Add all possible redirect URLs (localhost + production)

**Apple OAuth:**
- ❌ "invalid_client" → Verify Service ID is configured correctly
- ❌ Key file issues → Ensure .p8 key file path is correct and readable
- ✅ **Solution**: Apple requires HTTPS in production (no localhost exceptions)

### Development Tips
- Start with Google (easiest to set up)
- Test each provider individually before moving to next
- Use ngrok for testing OAuth with HTTPS locally
- Keep OAuth provider docs open while implementing
- Test account linking (same email, different provider)
