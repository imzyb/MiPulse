import { jwt } from 'hono/jwt';

let _handler = null;

export const authMiddleware = async (c, next) => {
    const secret = c.env.JWT_SECRET || 'mipulse-secret-key';
    if (!_handler) {
        _handler = jwt({
            secret: secret,
            alg: 'HS256'
        });
    }
    return _handler(c, next);
};
