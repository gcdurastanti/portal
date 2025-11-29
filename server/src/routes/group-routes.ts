import { Router } from 'express';
import { PortalDatabase } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth-middleware';
import { v4 as uuidv4 } from 'uuid';

export function createGroupRoutes(db: PortalDatabase): Router {
    const router = Router();

    // All group routes require authentication
    router.use(authMiddleware);

    // Debug logging
    router.use((req, res, next) => {
        console.log(`[GroupRouter] Received ${req.method} request for ${req.path}`);
        console.log(`[GroupRouter] Params:`, req.params);
        next();
    });

    // POST /api/groups - Create a new group
    router.post('/', (req: AuthRequest, res) => {
        try {
            const { name } = req.body;

            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({ error: 'Group name is required' });
            }

            const groupId = uuidv4();
            const userId = req.userId!;

            // Create group
            db.createGroup(groupId, name.trim(), userId);

            // Add creator as owner
            const membershipId = uuidv4();
            db.addGroupMember({
                id: membershipId,
                groupId,
                userId,
                role: 'owner'
            });

            const group = db.getGroup(groupId);

            res.status(201).json({ group });
        } catch (error) {
            console.error('Create group error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/groups/accept-invite/:token - Accept a group invitation
    // IMPORTANT: This must come BEFORE /:groupId routes to avoid "accept-invite" being matched as a groupId
    router.post('/accept-invite/:token', (req: AuthRequest, res) => {
        try {
            const { token } = req.params;
            const userId = req.userId!;

            const invitation = db.getInvitationByToken(token);

            if (!invitation) {
                return res.status(404).json({ error: 'Invitation not found' });
            }

            if (invitation.status !== 'pending') {
                return res.status(400).json({ error: 'Invitation already used or expired' });
            }

            // Check if invitation is expired
            if (new Date(invitation.expiresAt) < new Date()) {
                db.updateInvitationStatus(token, 'expired');
                return res.status(400).json({ error: 'Invitation has expired' });
            }

            // Check if user email matches invitation
            const user = db.getUserById(userId);
            if (user?.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
                return res.status(403).json({
                    error: 'This invitation was sent to a different email address'
                });
            }

            // Check if user is already a member
            if (db.isUserInGroup(userId, invitation.groupId)) {
                return res.status(400).json({ error: 'You are already a member of this group' });
            }

            // Add user to group
            const membershipId = uuidv4();
            db.addGroupMember({
                id: membershipId,
                groupId: invitation.groupId,
                userId,
                role: 'member'
            });

            // Mark invitation as accepted
            db.updateInvitationStatus(token, 'accepted');

            const group = db.getGroup(invitation.groupId);

            res.json({
                success: true,
                group
            });
        } catch (error) {
            console.error('Accept invitation error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/groups/:groupId/invite - Invite a user to the group
    router.post('/:groupId/invite', (req: AuthRequest, res) => {
        try {
            const { groupId } = req.params;
            const { email } = req.body;
            const userId = req.userId!;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({ error: 'Email is required' });
            }

            // Check if user is a member of the group
            if (!db.isUserInGroup(userId, groupId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Check if group exists
            const group = db.getGroup(groupId);
            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }

            // Generate invitation token
            const invitationId = uuidv4();
            const token = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

            db.createInvitation({
                id: invitationId,
                groupId,
                invitedByUserId: userId,
                invitedEmail: email.toLowerCase().trim(),
                token,
                status: 'pending',
                expiresAt: expiresAt.toISOString()
            });

            res.status(201).json({
                invitation: {
                    id: invitationId,
                    email: email.toLowerCase().trim(),
                    token,
                    expiresAt: expiresAt.toISOString()
                }
            });
        } catch (error) {
            console.error('Create invitation error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/groups/:groupId/members - Add a user directly to the group
    router.post('/:groupId/members', (req: AuthRequest, res) => {
        try {
            const { groupId } = req.params;
            const { email, role = 'member' } = req.body;
            const userId = req.userId!;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({ error: 'Email is required' });
            }

            // Validate role
            if (role && !['member', 'admin'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role. Must be "member" or "admin"' });
            }

            // Check if requesting user is a member of the group
            if (!db.isUserInGroup(userId, groupId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Check if requesting user has permission (must be owner or admin)
            const requesterRole = db.getUserMembershipRole(userId, groupId);
            if (requesterRole !== 'owner' && requesterRole !== 'admin') {
                return res.status(403).json({ error: 'Only owners and admins can add members' });
            }

            // Check if group exists
            const group = db.getGroup(groupId);
            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }

            // Find the user to add
            const targetUser = db.getUserByEmail(email.toLowerCase().trim());
            if (!targetUser) {
                return res.status(404).json({
                    error: 'User not found',
                    suggestion: 'Send an invitation instead to invite new users'
                });
            }

            // Check if user is already a member
            if (db.isUserInGroup(targetUser.id, groupId)) {
                return res.status(400).json({ error: 'User is already a member of this group' });
            }

            // Add user to group
            const membershipId = uuidv4();
            db.addGroupMember({
                id: membershipId,
                groupId,
                userId: targetUser.id,
                role: role as 'member' | 'admin'
            });

            // Return updated members list
            const members = db.getGroupMembers(groupId);

            res.status(201).json({
                success: true,
                member: {
                    id: targetUser.id,
                    displayName: targetUser.displayName,
                    email: targetUser.email,
                    role,
                    avatarUrl: targetUser.avatarUrl
                },
                members
            });
        } catch (error) {
            console.error('Add member error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PATCH /api/groups/:groupId/members/:targetUserId - Update member role
    router.patch('/:groupId/members/:targetUserId', (req: AuthRequest, res) => {
        try {
            const { groupId, targetUserId } = req.params;
            const { role } = req.body;
            const userId = req.userId!;

            if (!role || !['member', 'admin', 'owner'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role. Must be "member", "admin", or "owner"' });
            }

            // Check if requesting user is in the group
            if (!db.isUserInGroup(userId, groupId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Only owners can change roles
            const requesterRole = db.getUserMembershipRole(userId, groupId);
            if (requesterRole !== 'owner') {
                return res.status(403).json({ error: 'Only owners can change member roles' });
            }

            // Check if target user is in the group
            if (!db.isUserInGroup(targetUserId, groupId)) {
                return res.status(404).json({ error: 'Member not found' });
            }

            // Prevent demoting the last owner
            if (role !== 'owner') {
                const members = db.getGroupMembers(groupId);
                const owners = members.filter(m => m.role === 'owner');
                const targetMember = members.find(m => m.id === targetUserId);

                if (targetMember?.role === 'owner' && owners.length === 1) {
                    return res.status(400).json({
                        error: 'Cannot demote the last owner. Promote another member to owner first.'
                    });
                }
            }

            // Update role
            db.updateMemberRole(groupId, targetUserId, role as 'owner' | 'admin' | 'member');

            // Return updated members list
            const members = db.getGroupMembers(groupId);

            res.json({
                success: true,
                members
            });
        } catch (error) {
            console.error('Update member role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE /api/groups/:groupId/members/:targetUserId - Remove a member from the group
    router.delete('/:groupId/members/:targetUserId', (req: AuthRequest, res) => {
        try {
            const { groupId, targetUserId } = req.params;
            const userId = req.userId!;

            // Check if requesting user is in the group
            if (!db.isUserInGroup(userId, groupId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const members = db.getGroupMembers(groupId);
            const requester = members.find(m => m.id === userId);
            const target = members.find(m => m.id === targetUserId);

            if (!requester || !target) {
                return res.status(404).json({ error: 'Member not found' });
            }

            // Allow if removing self (leave group)
            if (userId === targetUserId) {
                db.removeGroupMember(groupId, targetUserId);
                return res.json({ success: true });
            }

            // Allow if requester is owner and target is not owner
            if (requester.role === 'owner' && target.role !== 'owner') {
                db.removeGroupMember(groupId, targetUserId);
                return res.json({ success: true });
            }

            return res.status(403).json({
                error: 'You do not have permission to remove this member'
            });
        } catch (error) {
            console.error('Remove member error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET /api/groups/:groupId - Get group details
    // IMPORTANT: This must come AFTER all more specific routes to avoid matching them
    router.get('/:groupId', (req: AuthRequest, res) => {
        try {
            const { groupId } = req.params;
            const userId = req.userId!;

            // Check if user is a member of the group
            if (!db.isUserInGroup(userId, groupId)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const group = db.getGroup(groupId);

            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }

            const members = db.getGroupMembers(groupId);

            res.json({ group, members });
        } catch (error) {
            console.error('Get group error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Debug catch-all
    router.use((req, res) => {
        console.log(`[GroupRouter] No match found for ${req.method} ${req.path}`);
        res.status(404).json({ error: 'Route not found in GroupRouter', path: req.path });
    });

    return router;
}
