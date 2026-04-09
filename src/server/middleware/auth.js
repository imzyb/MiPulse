import { jwt } from 'hono/jwt';

function getJwtSecret(env) {
    // 生产环境强制要求 JWT_SECRET 环境变量
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required in production environment');
    }
    return env.JWT_SECRET;
}

export const authMiddleware = async (c, next) => {
    const handler = jwt({
        secret: getJwtSecret(c.env),
        alg: 'HS256'
    });
    return handler(c, next);
};
