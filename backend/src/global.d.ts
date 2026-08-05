import type { UserRow } from './lib/types.js';

declare global {
  namespace Express {
    interface Request {
      user: (UserRow & { _sessionId?: string }) | null;
    }
  }
}

export {};
