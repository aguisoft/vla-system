import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';

const mockUser = {
  id: 'user-1',
  email: 'test@vla.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'STAFF',
  isActive: true,
  passwordHash: bcrypt.hashSync('secret123', 10),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let prisma: { user: jest.Mocked<{ findUnique: any; create: any; update: any }> };
  let hooks: jest.Mocked<Pick<HookService, 'doAction'>>;

  beforeEach(async () => {
    usersService = { findByEmail: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
    hooks = { doAction: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: HookService, useValue: hooks },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── validateUser ──────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('returns user without passwordHash on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      const result = await service.validateUser('test@vla.com', 'secret123');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@vla.com');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);

      await expect(service.validateUser('test@vla.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser('none@vla.com', 'x')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(service.validateUser('test@vla.com', 'secret123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when user has no passwordHash (Google-only account)', async () => {
      usersService.findByEmail.mockResolvedValue({ ...mockUser, passwordHash: null } as any);

      await expect(service.validateUser('test@vla.com', 'any')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns access_token and user shape', async () => {
      const result = await service.login(mockUser);

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
      });
    });

    it('signs JWT with sub, email and role', async () => {
      await service.login(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockUser.id, email: mockUser.email, role: mockUser.role }),
      );
    });

    it('fires AUTH_LOGIN hook', async () => {
      await service.login(mockUser);

      expect(hooks.doAction).toHaveBeenCalledWith(
        expect.stringContaining('auth.login'),
        expect.objectContaining({ user: mockUser }),
      );
    });
  });

  // ─── findOrCreateGoogleUser ────────────────────────────────────────────────

  describe('findOrCreateGoogleUser', () => {
    const profile = {
      googleId: 'gid-123',
      email: 'google@vla.com',
      firstName: 'Google',
      lastName: 'User',
    };

    it('returns existing user found by googleId', async () => {
      const existing = { ...mockUser, googleId: 'gid-123', isActive: true };
      prisma.user.findUnique.mockResolvedValue(existing as any);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(result).toEqual(existing);
    });

    it('creates a new user when neither googleId nor email matches', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // not found by googleId or email
      const created = { ...mockUser, googleId: 'gid-123', isActive: true };
      prisma.user.create.mockResolvedValue(created as any);

      const result = await service.findOrCreateGoogleUser(profile);

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false } as any);

      await expect(service.findOrCreateGoogleUser(profile)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
