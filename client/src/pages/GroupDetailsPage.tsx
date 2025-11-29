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

    const [addMemberEmail, setAddMemberEmail] = useState('');
    const [addMemberRole, setAddMemberRole] = useState<'member' | 'admin'>('member');
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [addMemberError, setAddMemberError] = useState('');
    const [addMemberSuccess, setAddMemberSuccess] = useState('');

    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    const [showInviteSection, setShowInviteSection] = useState(false);

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

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addMemberEmail.trim()) return;

        setIsAddingMember(true);
        setAddMemberError('');
        setAddMemberSuccess('');

        try {
            const response = await api.post<{ success: boolean; member: Member; members: Member[] }>(
                `/groups/${groupId}/members`,
                {
                    email: addMemberEmail,
                    role: addMemberRole
                }
            );
            setMembers(response.members);
            setAddMemberSuccess(`${response.member.displayName} added to the group!`);
            setAddMemberEmail('');
            setAddMemberRole('member');
        } catch (err: any) {
            if (err.message?.includes('User not found')) {
                setAddMemberError('User not found. Try sending an invitation instead.');
                setShowInviteSection(true);
                setInviteEmail(addMemberEmail);
            } else {
                setAddMemberError(err.message || 'Failed to add member');
            }
        } finally {
            setIsAddingMember(false);
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
            setShowInviteSection(false);
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
            fetchGroupDetails();
        } catch (err: any) {
            alert(err.message || 'Failed to remove member');
        }
    };

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        try {
            const response = await api.patch<{ success: boolean; members: Member[] }>(
                `/groups/${groupId}/members/${memberId}`,
                { role: newRole }
            );
            setMembers(response.members);
        } catch (err: any) {
            alert(err.message || 'Failed to update role');
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

    const currentUserMember = members.find(m => m.id === user?.id);
    const isOwner = currentUserMember?.role === 'owner';
    const isAdmin = currentUserMember?.role === 'admin';
    const canAddMembers = isOwner || isAdmin;

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner': return '#ff6b6b';
            case 'admin': return '#4a90e2';
            default: return 'rgba(255,255,255,0.3)';
        }
    };

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

                {/* Add Member Section - Only for owners and admins */}
                {canAddMembers && (
                    <div className="add-member-section" style={{ marginBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
                        <h3 style={{ color: 'white', marginBottom: '15px' }}>Add Member</h3>
                        {addMemberSuccess && <div className="auth-success" style={{ color: '#4caf50', background: 'rgba(76,175,80,0.1)', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>{addMemberSuccess}</div>}
                        {addMemberError && <div className="auth-error">{addMemberError}</div>}

                        <form onSubmit={handleAddMember} className="auth-form" style={{ flexDirection: 'row', gap: '10px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="email"
                                    value={addMemberEmail}
                                    onChange={(e) => setAddMemberEmail(e.target.value)}
                                    placeholder="Enter user's email address"
                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: 'white' }}
                                    disabled={isAddingMember}
                                />
                            </div>
                            {isOwner && (
                                <select
                                    value={addMemberRole}
                                    onChange={(e) => setAddMemberRole(e.target.value as 'member' | 'admin')}
                                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
                                    disabled={isAddingMember}
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            )}
                            <button
                                type="submit"
                                className="auth-button"
                                style={{ margin: 0, width: 'auto', whiteSpace: 'nowrap' }}
                                disabled={isAddingMember || !addMemberEmail.trim()}
                            >
                                {isAddingMember ? 'Adding...' : 'Add Member'}
                            </button>
                        </form>

                        {/* Invitation fallback section */}
                        {showInviteSection && (
                            <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(74,144,226,0.1)', borderRadius: '8px', border: '1px solid rgba(74,144,226,0.3)' }}>
                                <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '10px', fontSize: '0.9rem' }}>
                                    User not registered yet? Send them an invitation to join.
                                </p>
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
                        )}
                    </div>
                )}

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
                                            {member.email}
                                        </div>
                                    </div>
                                    <span style={{
                                        background: getRoleBadgeColor(member.role),
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        textTransform: 'uppercase'
                                    }}>
                                        {member.role}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {/* Role management dropdown for owners */}
                                    {isOwner && member.id !== user?.id && (
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                                            style={{
                                                background: 'rgba(0,0,0,0.3)',
                                                color: 'white',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                padding: '6px 10px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                            <option value="owner">Owner</option>
                                        </select>
                                    )}

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
                                    ) : isOwner && (
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            style={{
                                                background: 'transparent',
                                                color: 'rgba(255,255,255,0.5)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: '6px 12px'
                                            }}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
