/**
 * Approval Workflow Service
 * 
 * Manages content approval flows for teams:
 * - Multi-level approval chains
 * - Role-based permissions
 * - Approval history tracking
 * - Automated notifications
 */

const { db } = require('../db/db');
const { v4: uuidv4 } = require('uuid');

// Approval status constants
const APPROVAL_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REVISION_REQUESTED: 'revision_requested',
    CANCELLED: 'cancelled'
};

// Content types that can be approved
const CONTENT_TYPES = {
    CLIP: 'clip',
    POST: 'scheduled_post',
    CAMPAIGN: 'campaign'
};

/**
 * Create an approval request for content
 * @param {Object} data - Approval request data
 * @returns {Object} - Created approval request
 */
function createApprovalRequest(data) {
    const {
        companyId,
        contentType,
        contentId,
        requesterId,
        approverIds,
        notes,
        priority = 'normal'
    } = data;

    if (!approverIds || approverIds.length === 0) {
        throw new Error('At least one approver is required');
    }

    const id = uuidv4();
    const metadata = JSON.stringify({
        notes,
        priority,
        approvers: approverIds.map(approverId => ({
            userId: approverId,
            status: 'pending',
            respondedAt: null,
            comments: null
        })),
        history: [{
            action: 'created',
            userId: requesterId,
            timestamp: new Date().toISOString()
        }]
    });

    // Insert into database (using activity_log table for approvals)
    db.prepare(`
        INSERT INTO activity_log (id, company_id, user_id, action, entity_type, entity_id, metadata)
        VALUES (?, ?, ?, 'approval_requested', ?, ?, ?)
    `).run(id, companyId, requesterId, contentType, contentId, metadata);

    return {
        id,
        contentType,
        contentId,
        status: APPROVAL_STATUS.PENDING,
        requesterId,
        approvers: approverIds,
        priority,
        notes,
        createdAt: new Date().toISOString()
    };
}

/**
 * Get pending approvals for a user
 * @param {string} userId - Approver's user ID
 * @param {string} companyId - Company ID
 * @returns {Array} - Pending approval requests
 */
function getPendingApprovals(userId, companyId) {
    const approvals = db.prepare(`
        SELECT * FROM activity_log 
        WHERE company_id = ? AND action = 'approval_requested'
        AND metadata LIKE ?
        ORDER BY created_at DESC
    `).all(companyId, `%"userId":"${userId}"%"status":"pending"%`);

    return approvals.map(formatApprovalRequest);
}

/**
 * Get all approval requests for a company
 * @param {string} companyId - Company ID
 * @param {Object} filters - Optional filters
 * @returns {Array} - Approval requests
 */
function getApprovalRequests(companyId, filters = {}) {
    let query = `SELECT * FROM activity_log WHERE company_id = ? AND action = 'approval_requested'`;
    const params = [companyId];

    if (filters.status) {
        query += ` AND metadata LIKE ?`;
        params.push(`%"status":"${filters.status}"%`);
    }

    if (filters.contentType) {
        query += ` AND entity_type = ?`;
        params.push(filters.contentType);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
    }

    const results = db.prepare(query).all(...params);
    return results.map(formatApprovalRequest);
}

/**
 * Respond to an approval request
 * @param {string} approvalId - Approval request ID
 * @param {string} userId - Responding user ID
 * @param {string} response - 'approve', 'reject', or 'request_revision'
 * @param {string} comments - Optional comments
 * @returns {Object} - Updated approval request
 */
function respondToApproval(approvalId, userId, response, comments = null) {
    const approval = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(approvalId);
    if (!approval) throw new Error('Approval request not found');

    const metadata = JSON.parse(approval.metadata);

    // Find this user in approvers
    const approverIndex = metadata.approvers.findIndex(a => a.userId === userId);
    if (approverIndex === -1) {
        throw new Error('User is not an approver for this request');
    }

    // Update approver status
    metadata.approvers[approverIndex] = {
        ...metadata.approvers[approverIndex],
        status: response === 'approve' ? 'approved' : response === 'reject' ? 'rejected' : 'revision_requested',
        respondedAt: new Date().toISOString(),
        comments
    };

    // Add to history
    metadata.history.push({
        action: response,
        userId,
        comments,
        timestamp: new Date().toISOString()
    });

    // Determine overall status
    const allApproved = metadata.approvers.every(a => a.status === 'approved');
    const anyRejected = metadata.approvers.some(a => a.status === 'rejected');
    const anyRevision = metadata.approvers.some(a => a.status === 'revision_requested');

    let overallStatus = APPROVAL_STATUS.PENDING;
    if (allApproved) {
        overallStatus = APPROVAL_STATUS.APPROVED;
        // Update the content status if fully approved
        updateContentStatus(approval.entity_type, approval.entity_id, 'approved');
    } else if (anyRejected) {
        overallStatus = APPROVAL_STATUS.REJECTED;
        updateContentStatus(approval.entity_type, approval.entity_id, 'rejected');
    } else if (anyRevision) {
        overallStatus = APPROVAL_STATUS.REVISION_REQUESTED;
        updateContentStatus(approval.entity_type, approval.entity_id, 'revision_requested');
    }

    metadata.overallStatus = overallStatus;

    // Save updated metadata
    db.prepare('UPDATE activity_log SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(metadata), approvalId);

    return formatApprovalRequest({ ...approval, metadata: JSON.stringify(metadata) });
}

/**
 * Cancel an approval request
 * @param {string} approvalId - Approval request ID
 * @param {string} userId - User requesting cancellation
 * @returns {Object} - Cancelled approval
 */
function cancelApproval(approvalId, userId) {
    const approval = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(approvalId);
    if (!approval) throw new Error('Approval request not found');

    const metadata = JSON.parse(approval.metadata);
    metadata.overallStatus = APPROVAL_STATUS.CANCELLED;
    metadata.history.push({
        action: 'cancelled',
        userId,
        timestamp: new Date().toISOString()
    });

    db.prepare('UPDATE activity_log SET metadata = ? WHERE id = ?')
        .run(JSON.stringify(metadata), approvalId);

    return { id: approvalId, status: 'cancelled' };
}

/**
 * Update content status based on approval
 */
function updateContentStatus(contentType, contentId, status) {
    switch (contentType) {
        case CONTENT_TYPES.CLIP:
            db.prepare('UPDATE clips SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(status, contentId);
            break;
        case CONTENT_TYPES.POST:
            db.prepare('UPDATE scheduled_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(status, contentId);
            break;
        case CONTENT_TYPES.CAMPAIGN:
            db.prepare('UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(status, contentId);
            break;
    }
}

/**
 * Format approval request for response
 */
function formatApprovalRequest(row) {
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    return {
        id: row.id,
        contentType: row.entity_type,
        contentId: row.entity_id,
        status: metadata.overallStatus || APPROVAL_STATUS.PENDING,
        priority: metadata.priority || 'normal',
        notes: metadata.notes,
        approvers: metadata.approvers,
        history: metadata.history,
        createdAt: row.created_at
    };
}

/**
 * Get approval statistics for a company
 * @param {string} companyId - Company ID
 * @returns {Object} - Approval statistics
 */
function getApprovalStats(companyId) {
    const all = getApprovalRequests(companyId);

    return {
        total: all.length,
        pending: all.filter(a => a.status === APPROVAL_STATUS.PENDING).length,
        approved: all.filter(a => a.status === APPROVAL_STATUS.APPROVED).length,
        rejected: all.filter(a => a.status === APPROVAL_STATUS.REJECTED).length,
        revisionRequested: all.filter(a => a.status === APPROVAL_STATUS.REVISION_REQUESTED).length,
        byContentType: {
            clips: all.filter(a => a.contentType === CONTENT_TYPES.CLIP).length,
            posts: all.filter(a => a.contentType === CONTENT_TYPES.POST).length,
            campaigns: all.filter(a => a.contentType === CONTENT_TYPES.CAMPAIGN).length
        }
    };
}

module.exports = {
    createApprovalRequest,
    getPendingApprovals,
    getApprovalRequests,
    respondToApproval,
    cancelApproval,
    getApprovalStats,
    APPROVAL_STATUS,
    CONTENT_TYPES
};
