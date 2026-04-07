export declare enum UserRole {
    ADMIN = "ADMIN",
    STAFF = "STAFF",
    STUDENT = "STUDENT",
    PROFESSOR = "PROFESSOR"
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
    iat?: number;
    exp?: number;
}
//# sourceMappingURL=user.types.d.ts.map