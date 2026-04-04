import { jwt } from 'hono/jwt';

function getJwtSecret(env) {
    return env.JWT_SECRET || 'mipulse-secret-key';
}

export const authMiddleware = async (c, next) => {
    const handler = jwt({
        secret: getJwtSecret(c.env),
        alg: 'HS256'
    });
    return handler(c, next);
};
