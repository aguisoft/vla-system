export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  STUDENT = 'STUDENT',
  PROFESSOR = 'PROFESSOR',
}

export interface UserBase {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  permissions: string[];
  /** Set when an admin is impersonating this user — contains the admin's user id */
  impersonatedBy?: string;
  iat?: number;
  exp?: number;
}
