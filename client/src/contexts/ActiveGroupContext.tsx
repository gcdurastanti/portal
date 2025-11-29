import React, { createContext, useContext, useState, useEffect } from 'react';
import { config } from '../config';

interface ActiveGroupContextType {
    activeGroupId: string;
    setActiveGroupId: (id: string) => void;
}

const ActiveGroupContext = createContext<ActiveGroupContextType | undefined>(undefined);

export function ActiveGroupProvider({ children }: { children: React.ReactNode }) {
    const [activeGroupId, setActiveGroupIdState] = useState<string>(() => {
        return localStorage.getItem('portal_active_group_id') || config.groupId;
    });

    const setActiveGroupId = (id: string) => {
        setActiveGroupIdState(id);
        localStorage.setItem('portal_active_group_id', id);
    };

    return (
        <ActiveGroupContext.Provider value={{ activeGroupId, setActiveGroupId }}>
            {children}
        </ActiveGroupContext.Provider>
    );
}

export function useActiveGroup() {
    const context = useContext(ActiveGroupContext);
    if (context === undefined) {
        throw new Error('useActiveGroup must be used within an ActiveGroupProvider');
    }
    return context;
}
