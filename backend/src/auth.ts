import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const sessions = new Map<string, { user: string; expires: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 часа

export function createSession(user: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + SESSION_TTL });
  return token;
}

export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

// Периодическая очистка истёкших сессий
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expires) sessions.delete(token);
  }
}, 600000); // каждые 10 минут

// Публичные эндпоинты, не требующие авторизации
const PUBLIC_PATHS = ['/api/health', '/api/auth/login', '/api/auth/check'];

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  if (PUBLIC_PATHS.includes(path) || path.startsWith('/api/sub/')) {
    return next();
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !validateSession(token)) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  next();
}
