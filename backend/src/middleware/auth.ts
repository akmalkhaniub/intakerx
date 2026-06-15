import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'patient' | 'clinician';
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required.' });
    return;
  }

  jwt.verify(token, config.jwtSecret, (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token.' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'patient',
    };
    next();
  });
}

export function requireRole(role: 'patient' | 'clinician') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: `Forbidden: requires ${role} role.` });
      return;
    }
    next();
  };
}
