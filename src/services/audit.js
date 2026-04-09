/**
 * Audit Logging Service
 * Records security-relevant actions for compliance and forensics
 */

/**
 * Generate a unique ID for audit log entries
 * @returns {string} Unique ID
 */
function generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Record an audit log entry
 * @param {Object} db - Database instance
 * @param {Object} options - Audit log options
 * @param {string} options.userId - User ID who performed the action
 * @param {string} options.action - Action type (e.g., 'LOGIN', 'CREATE_NODE', 'UPDATE_SETTINGS')
 * @param {string} [options.resourceType] - Type of resource (e.g., 'vps_node', 'user', 'setting')
 * @param {string} [options.resourceId] - ID of the affected resource
 * @param {any} [options.oldValue] - Previous value (for updates/deletes)
 * @param {any} [options.newValue] - New value (for creates/updates)
 * @param {string} [options.ipAddress] - Client IP address
 * @param {string} [options.userAgent] - Client user agent
 * @returns {Promise<string>} The audit log ID
 */
export async function logAudit(db, {
    userId,
    action,
    resourceType = null,
    resourceId = null,
    oldValue = null,
    newValue = null,
    ipAddress = null,
    userAgent = null
}) {
    const id = generateAuditId();
    const createdAt = new Date().toISOString();
    
    try {
        await db.prepare(`
            INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            userId || null,
            action,
            resourceType || null,
            resourceId || null,
            oldValue ? JSON.stringify(oldValue) : null,
            newValue ? JSON.stringify(newValue) : null,
            ipAddress || null,
            userAgent || null,
            createdAt
        ).run();
        
        return id;
    } catch (error) {
        // Fail silently to avoid breaking main functionality
        // In production, you might want to log this to a separate error tracking system
        console.error('Failed to record audit log:', error);
        return null;
    }
}

/**
 * Action types for audit logging
 */
export const AuditActions = {
    // Authentication
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    PROFILE_UPDATE: 'PROFILE_UPDATE',
    
    // VPS Node operations
    CREATE_NODE: 'CREATE_NODE',
    UPDATE_NODE: 'UPDATE_NODE',
    DELETE_NODE: 'DELETE_NODE',
    RESET_NODE_TRAFFIC: 'RESET_NODE_TRAFFIC',
    RESET_NODE_SECRET: 'RESET_NODE_SECRET',
    
    // Network Target operations
    CREATE_TARGET: 'CREATE_TARGET',
    UPDATE_TARGET: 'UPDATE_TARGET',
    DELETE_TARGET: 'DELETE_TARGET',
    FORCE_CHECK_TARGET: 'FORCE_CHECK_TARGET',
    
    // Settings operations
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    
    // Alert operations
    CLEAR_ALERTS: 'CLEAR_ALERTS',
    
    // Permission operations
    ROLE_CHANGE: 'ROLE_CHANGE'
};

/**
 * Resource types for audit logging
 */
export const ResourceTypes = {
    USER: 'user',
    VPS_NODE: 'vps_node',
    NETWORK_TARGET: 'network_target',
    SETTING: 'setting',
    ALERT: 'alert'
};

/**
 * Create a middleware to automatically log requests
 * @param {Array<string>} actionsToLog - List of actions to log
 * @returns {Function} Hono middleware
 */
export function createAuditMiddleware(actionsToLog = []) {
    return async (c, next) => {
        await next();
        
        // Extract user info from JWT payload if available
        const payload = c.get('jwtPayload');
        const userId = payload?.id || null;
        
        // Get client info
        const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null;
        const userAgent = c.req.header('user-agent') || null;
        
        // Determine action based on route and method
        const path = c.req.path;
        const method = c.req.method;
        
        let action = null;
        let resourceType = null;
        let resourceId = null;
        
        // Simple route matching for common patterns
        if (path.includes('/api/auth/login') && method === 'POST') {
            action = AuditActions.LOGIN;
        } else if (path.includes('/api/auth/profile') && method === 'PUT') {
            action = AuditActions.PROFILE_UPDATE;
        } else if (path.includes('/api/vps/nodes') && method === 'POST') {
            action = AuditActions.CREATE_NODE;
            resourceType = ResourceTypes.VPS_NODE;
        } else if (path.includes('/api/vps/nodes/') && method === 'PUT') {
            action = AuditActions.UPDATE_NODE;
            resourceType = ResourceTypes.VPS_NODE;
            resourceId = path.split('/').pop();
        } else if (path.includes('/api/vps/nodes/') && method === 'DELETE') {
            action = AuditActions.DELETE_NODE;
            resourceType = ResourceTypes.VPS_NODE;
            resourceId = path.split('/').pop();
        } else if (path.includes('/api/vps/settings') && method === 'POST') {
            action = AuditActions.UPDATE_SETTINGS;
            resourceType = ResourceTypes.SETTING;
        }
        
        // Log if action is in the whitelist or no whitelist provided
        if (action && (actionsToLog.length === 0 || actionsToLog.includes(action))) {
            await logAudit(c.env.MIPULSE_DB, {
                userId,
                action,
                resourceType,
                resourceId,
                ipAddress,
                userAgent
            });
        }
    };
}
