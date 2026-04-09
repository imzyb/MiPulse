import { z } from 'zod';

// ==================== Auth Schemas ====================

export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required').max(64, 'Username too long'),
    password: z.string().min(1, 'Password is required').max(128, 'Password too long')
});

export const profileUpdateSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newUsername: z.string().min(1, 'New username is required').max(64, 'Username too long').optional(),
    newPassword: z.string().min(1, 'New password is required').max(128, 'Password too long').optional()
}).refine(data => {
    // 至少更新用户名或密码之一
    return !!data.newUsername || !!data.newPassword;
}, { message: 'Either newUsername or newPassword must be provided' });

// ==================== VPS Node Schemas ====================

export const createNodeSchema = z.object({
    name: z.string().min(1, 'Node name is required').max(128, 'Node name too long'),
    tag: z.string().max(64, 'Tag too long').optional(),
    groupTag: z.string().max(64, 'Group tag too long').optional().default('Default'),
    region: z.string().max(64, 'Region too long').optional().default('Global'),
    enabled: z.boolean().optional().default(true),
    secret: z.string().max(64, 'Secret too long').optional()
});

export const updateNodeSchema = z.object({
    name: z.string().min(1, 'Node name is required').max(128, 'Node name too long').optional(),
    tag: z.string().max(64, 'Tag too long').optional(),
    groupTag: z.string().max(64, 'Group tag too long').optional(),
    region: z.string().max(64, 'Region too long').optional(),
    enabled: z.boolean().optional(),
    secret: z.string().max(64, 'Secret too long').optional(),
    networkMonitorEnabled: z.boolean().optional(),
    resetSecret: z.boolean().optional()
});

export const resetTrafficSchema = z.object({});

// ==================== Network Target Schemas ====================

export const createTargetSchema = z.object({
    nodeId: z.string().min(1, 'Node ID is required').max(64, 'Node ID too long'),
    type: z.enum(['http', 'https', 'tcp', 'icmp'], { errorMap: () => ({ message: 'Invalid target type' }) }),
    target: z.string().min(1, 'Target is required').max(255, 'Target too long'),
    name: z.string().max(128, 'Name too long').optional()
});

export const updateTargetSchema = z.object({
    type: z.enum(['http', 'https', 'tcp', 'icmp']).optional(),
    target: z.string().min(1).max(255).optional(),
    name: z.string().max(128).optional(),
    scheme: z.string().max(16).optional(),
    port: z.number().int().positive().max(65535).optional(),
    path: z.string().max(512).optional(),
    enabled: z.boolean().optional()
});

export const checkTargetSchema = z.object({
    targetId: z.string().min(1, 'Target ID is required'),
    nodeId: z.string().min(1, 'Node ID is required')
});

// ==================== Report Schema ====================

export const reportSchema = z.object({
    ts: z.union([z.string(), z.number()]).optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    cpuPercent: z.number().min(0).max(100).optional(),
    memPercent: z.number().min(0).max(100).optional(),
    diskPercent: z.number().min(0).max(100).optional(),
    load1: z.number().min(0).optional(),
    latencyMs: z.number().min(0).optional(),
    lossPercent: z.number().min(0).max(100).optional(),
    traffic: z.object({
        rx: z.union([z.number(), z.string()]).optional(),
        tx: z.union([z.number(), z.string()]).optional()
    }).optional(),
    checks: z.array(z.any()).optional(),
    nodeId: z.string().optional(),
    id: z.string().optional(),
    nodeSecret: z.string().optional(),
    secret: z.string().optional()
});

// ==================== Settings Schema ====================

export const settingsSchema = z.record(z.string(), z.any());

// ==================== Notification Test Schema ====================

export const notificationTestSchema = z.object({});

// ==================== Helper Functions ====================

/**
 * Validate and parse request body against a schema
 * @param {any} data - Raw request body
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {{ success: boolean, data?: any, errors?: any[] }}
 */
export function validateBody(data, schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
        return {
            success: false,
            errors: result.error.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
            }))
        };
    }
    return { success: true, data: result.data };
}

/**
 * Create a Hono validator middleware compatible handler
 * @param {z.ZodSchema} schema - Zod schema
 * @param {(c: any, data: any) => Promise<Response>} handler - Route handler
 * @returns {Function}
 */
export function createValidator(schema, handler) {
    return async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const validation = validateBody(body, schema);
        
        if (!validation.success) {
            return c.json({ 
                success: false, 
                error: 'Validation failed',
                details: validation.errors 
            }, 400);
        }
        
        // Attach validated data to context
        c.set('validatedData', validation.data);
        return handler(c, validation.data);
    };
}
