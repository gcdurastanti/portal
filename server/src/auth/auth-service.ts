import { PortalDatabase, User } from '../database';
import { hashPassword, verifyPassword, validatePassword, validateEmail } from './password-utils';
import { generateToken, JWTPayload } from './session-manager';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterRequest {
    email: string;
    password: string;
    displayName: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    user?: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
    };
    token?: string;
    error?: string;
}

export class AuthService {
    constructor(private db: PortalDatabase) { }

    async register(req: RegisterRequest): Promise<AuthResponse> {
        // Validate email
        if (!validateEmail(req.email)) {
            return { success: false, error: 'Invalid email address' };
        }

        // Validate password
        const passwordValidation = validatePassword(req.password);
        if (!passwordValidation.valid) {
            return { success: false, error: passwordValidation.error };
        }

        // Check if user already exists
        const existingUser = this.db.getUserByEmail(req.email);
        if (existingUser) {
            return { success: false, error: 'User with this email already exists' };
        }

        // Hash password
        const passwordHash = await hashPassword(req.password);

        // Create user
        const userId = uuidv4();
        this.db.createUser({
            id: userId,
            email: req.email,
            passwordHash,
            displayName: req.displayName,
            avatarUrl: null,
            authProvider: 'email',
            oauthProviderId: null
        });

        // Generate token
        const token = generateToken({ userId, email: req.email });

        return {
            success: true,
            user: {
                id: userId,
                email: req.email,
                displayName: req.displayName,
                avatarUrl: null
            },
            token
        };
    }

    async login(req: LoginRequest): Promise<AuthResponse> {
        // Get user by email
        const user = this.db.getUserByEmail(req.email);
        if (!user) {
            return { success: false, error: 'Invalid email or password' };
        }

        // Check if user registered with OAuth
        if (!user.passwordHash) {
            return {
                success: false,
                error: `This account was created with ${user.authProvider}. Please use ${user.authProvider} to login.`
            };
        }

        // Verify password
        const isValid = await verifyPassword(req.password, user.passwordHash);
        if (!isValid) {
            return { success: false, error: 'Invalid email or password' };
        }

        // Generate token
        const token = generateToken({ userId: user.id, email: user.email });

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl
            },
            token
        };
    }

    getUserById(userId: string): User | null {
        return this.db.getUserById(userId);
    }

    getUserGroups(userId: string) {
        return this.db.getUserGroups(userId);
    }
}
