import { Request } from 'express';
import { Installation, User } from '../entities/entities';

export interface CurrentUser extends Pick<User, 'id' | 'issuer' | 'subject' | 'email' | 'displayName'> {}

export interface AuthenticatedRequest extends Request {
  user?: CurrentUser;
  installation?: Installation;
}
