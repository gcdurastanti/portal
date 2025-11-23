import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = api.getToken();
            if (token) {
                try {
                    const response = await api.get<{ user: User }>('/auth/me');
                    setUser(response.user);
                } catch (error) {
                    console.error('Failed to restore session:', error);
                    api.setToken(null);
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = (token: string, newUser: User) => {
        api.setToken(token);
        setUser(newUser);
    };

    const logout = () => {
        api.setToken(null);
        setUser(null);
        // Optional: Call logout endpoint
        try {
            api.post('/auth/logout', {});
        } catch (e) {
            // Ignore logout errors
        }
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
            updateUser
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
