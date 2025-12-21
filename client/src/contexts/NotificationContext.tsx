import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationAction {
    label: string;
    onClick: () => void;
}

export interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    action?: NotificationAction;
    duration?: number;
}

interface NotificationContextType {
    showNotification: (message: string, type?: Notification['type'], action?: NotificationAction, duration?: number) => void;
    dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = useCallback((message: string, type: Notification['type'] = 'info', action?: NotificationAction, duration: number = 5000) => {
        const id = uuidv4();
        const newNotification: Notification = { id, message, type, action, duration };

        setNotifications(prev => [...prev, newNotification]);

        if (duration > 0) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, duration);
        }
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification, dismissNotification }}>
            {children}
            <div className="notification-container">
                {notifications.map(notification => (
                    <div key={notification.id} className={`notification ${notification.type}`}>
                        <div className="notification-content">
                            <span>{notification.message}</span>
                            {notification.action && (
                                <button
                                    className="notification-action"
                                    onClick={() => {
                                        notification.action!.onClick();
                                        dismissNotification(notification.id);
                                    }}
                                >
                                    {notification.action.label}
                                </button>
                            )}
                        </div>
                        <button className="notification-close" onClick={() => dismissNotification(notification.id)}>×</button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}
