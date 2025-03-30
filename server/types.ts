import { User } from '@shared/schema';

declare module 'express-session' {
  interface SessionData {
    user?: User;
    userId?: number;
  }
}