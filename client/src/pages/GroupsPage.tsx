import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import '../components/auth/Auth.css'; // Reuse auth styles for consistency

interface Group {
    id: string;
    name: string;
    deviceIds: string[];
}

export const GroupsPage: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            // We need an endpoint to get user's groups. 
            // The login endpoint returns them, but we should have a dedicated GET /api/users/me/groups or similar.
            // For now, let's use /api/auth/me which returns groups
            const response = await api.get<{ groups: Group[] }>('/auth/me');
            setGroups(response.groups);
        } catch (err: any) {
            setError('Failed to load groups');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;

        setIsCreating(true);
        setCreateError('');

        try {
            const response = await api.post<{ group: Group }>('/groups', {
                name: newGroupName
            });
            setGroups([...groups, response.group]);
            setNewGroupName('');
        } catch (err: any) {
            setCreateError(err.message || 'Failed to create group');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="auth-container" style={{ justifyContent: 'flex-start', paddingTop: '60px' }}>
            <div className="auth-card" style={{ maxWidth: '600px' }}>
                <div className="auth-header">
                    <h1>My Family Groups</h1>
                    <p>Manage your circles and devices</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <div className="groups-list">
                    {isLoading ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : groups.length === 0 ? (
                        <div className="empty-state">
                            <p>You haven't joined any groups yet.</p>
                        </div>
                    ) : (
                        groups.map(group => (
                            <div key={group.id} className="group-item" style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '15px',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h3 style={{ margin: '0 0 5px 0', color: 'white' }}>{group.name}</h3>
                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                                        {group.deviceIds.length} devices
                                    </span>
                                </div>
                                <Link
                                    to={`/groups/${group.id}`}
                                    className="auth-button"
                                    style={{ padding: '8px 16px', fontSize: '0.9rem', margin: 0, textDecoration: 'none' }}
                                >
                                    Manage
                                </Link>
                            </div>
                        ))
                    )}
                </div>

                <div className="create-group-section" style={{ marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                    <h3 style={{ color: 'white', marginBottom: '15px' }}>Create New Group</h3>
                    {createError && <div className="auth-error">{createError}</div>}

                    <form onSubmit={handleCreateGroup} className="auth-form" style={{ flexDirection: 'row' }}>
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Family Name (e.g. The Smiths)"
                            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: 'white' }}
                            disabled={isCreating}
                        />
                        <button
                            type="submit"
                            className="auth-button"
                            style={{ margin: 0, width: 'auto', whiteSpace: 'nowrap' }}
                            disabled={isCreating || !newGroupName.trim()}
                        >
                            {isCreating ? 'Creating...' : 'Create Group'}
                        </button>
                    </form>
                </div>

                <div className="auth-footer">
                    <Link to="/">Back to Portal</Link>
                </div>
            </div>
        </div>
    );
};
