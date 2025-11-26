import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import '../components/auth/Auth.css';

interface Member {
    id: string;
    displayName: string;
    email: string;
    role: string;
    avatarUrl: string | null;
}

interface Group {
    id: string;
    name: string;
    deviceIds: string[];
}

export const GroupDetailsPage: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    useEffect(() => {
        if (groupId) {
            fetchGroupDetails();
        }
    }, [groupId]);

    const fetchGroupDetails = async () => {
        try {
            const response = await api.get<{ group: Group; members: Member[] }>(`/groups/${groupId}`);
            setGroup(response.group);
            setMembers(response.members);
        } catch (err: any) {
            setError('Failed to load group details');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;

        setIsInviting(true);
        setInviteError('');
        setInviteSuccess('');

        try {
            await api.post(`/groups/${groupId}/invite`, {
                email: inviteEmail
            });
            setInviteSuccess(`Invitation sent to ${inviteEmail}`);
            setInviteEmail('');
        } catch (err: any) {
            setInviteError(err.message || 'Failed to send invitation');
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;

        try {
            await api.delete(`/groups/${groupId}/members/${memberId}`);
            // Refresh members list
            fetchGroupDetails();
        } catch (err: any) {
            alert(err.message || 'Failed to remove member');
        }
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm('Are you sure you want to leave this group?')) return;

        try {
            await api.delete(`/groups/${groupId}/members/${user?.id}`);
            navigate('/groups');
        } catch (err: any) {
            alert(err.message || 'Failed to leave group');
        }
    };

    if (isLoading) return <div className="loading-screen">Loading...</div>;
    if (error) return <div className="auth-error">{error}</div>;
    if (!group) return <div className="auth-error">Group not found</div>;

    const isOwner = members.find(m => m.id === user?.id)?.role === 'owner';

    return (
        <div className="auth-container" style={{ justifyContent: 'flex-start', paddingTop: '60px' }}>
            <div className="auth-card" style={{ maxWidth: '800px' }}>
                <div className="auth-header" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{group.name}</h1>
                        <p>{members.length} members • {group.deviceIds.length} devices</p>
                    </div>
                    <Link to="/groups" className="auth-button" style={{ width: 'auto', textDecoration: 'none', padding: '8px 16px' }}>
                        Back to Groups
                    </Link>
                </div>

                <div className="members-section">
                    <h3 style={{ color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Members</h3>

                    <div className="members-list" style={{ marginTop: '15px' }}>
                        {members.map(member => (
                            <div key={member.id} className="member-item" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                marginBottom: '8px',
                                borderRadius: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: '#4a90e2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold'
                                    }}>
                                        {member.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ color: 'white', fontWeight: '500' }}>
                                            {member.displayName} {member.id === user?.id && '(You)'}
                                        </div>
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                                            {member.role} • {member.email}
                                        </div>
                                    </div>
                                </div>

                                {member.id === user?.id ? (
                                    <button
                                        onClick={handleLeaveGroup}
                                        style={{
                                            background: 'rgba(255,82,82,0.1)',
                                            color: '#ff5252',
                                            border: '1px solid rgba(255,82,82,0.3)',
                                            padding: '6px 12px',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Leave
                                    </button>
                                ) : (
                                    // TODO: Only show remove button if current user is owner/admin
                                    // For now, API restricts removing others to owner/admin logic (to be implemented fully)
                                    // But current API implementation only allows removing SELF.
                                    // We need to update API to allow owners to remove others.
                                    // For now, let's hide the button for others unless we update the API.
                                    // Wait, the user asked for "adding and removing users".
                                    // The API currently says: "For now, only allow removing yourself (leave group)"
                                    // I should update the API to allow owners to remove members.
                                    isOwner && (
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            style={{
                                                background: 'transparent',
                                                color: 'rgba(255,255,255,0.5)',
                                                border: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Remove
                                        </button>
                                    )
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="invite-section" style={{ marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                    <h3 style={{ color: 'white', marginBottom: '15px' }}>Invite New Member</h3>
                    {inviteSuccess && <div className="auth-success" style={{ color: '#4caf50', background: 'rgba(76,175,80,0.1)', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>{inviteSuccess}</div>}
                    {inviteError && <div className="auth-error">{inviteError}</div>}

                    <form onSubmit={handleInvite} className="auth-form" style={{ flexDirection: 'row' }}>
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Enter email address"
                            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: 'white' }}
                            disabled={isInviting}
                        />
                        <button
                            type="submit"
                            className="auth-button"
                            style={{ margin: 0, width: 'auto', whiteSpace: 'nowrap' }}
                            disabled={isInviting || !inviteEmail.trim()}
                        >
                            {isInviting ? 'Sending...' : 'Send Invite'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
