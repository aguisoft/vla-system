import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';

const mockUserRecord = {
  id: 'user-1',
  email: 'maria@vla.com',
  firstName: 'Maria',
  lastName: 'Lopez',
  role: 'STAFF',
  isActive: true,
  createdAt: new Date('2024-01-01'),
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: jest.Mocked<{ findUnique: any; findMany: any; create: any; update: any }> };
  let hooks: jest.Mocked<Pick<HookService, 'doAction' | 'applyFilter'>>;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    hooks = {
      doAction: jest.fn().mockResolvedValue(undefined),
      applyFilter: jest.fn().mockImplementation((_, v) => Promise.resolve(v)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: HookService, useValue: hooks },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─── findByEmail ──────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('delegates to prisma and returns the result', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserRecord as any);

      const result = await service.findByEmail('maria@vla.com');

      expect(result).toEqual(mockUserRecord);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'maria@vla.com' } });
    });

    it('returns null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      expect(await service.findByEmail('nobody@vla.com')).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      email: 'new@vla.com',
      password: 'pass1234',
      firstName: 'New',
      lastName: 'User',
      role: 'STAFF' as any,
    };

    it('hashes password and creates user', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing user
      prisma.user.create.mockResolvedValue({ ...mockUserRecord, email: dto.email } as any);

      const result = await service.create(dto);

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('password');
      expect(createCall.data).toHaveProperty('passwordHash');
      expect(result.email).toBe(dto.email);
    });

    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserRecord as any);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('fires USER_CREATED hook after creation', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUserRecord as any);

      await service.create(dto);

      expect(hooks.doAction).toHaveBeenCalledWith(
        expect.stringContaining('user.created'),
        expect.objectContaining({ user: mockUserRecord }),
      );
    });
  });

  // ─── findOrFail ───────────────────────────────────────────────────────────

  describe('findOrFail', () => {
    it('returns user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserRecord as any);

      const result = await service.findOrFail('user-1');

      expect(result).toEqual(mockUserRecord);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOrFail('ghost-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the user', async () => {
      const updated = { ...mockUserRecord, firstName: 'Updated' };
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUserRecord as any) // findOrFail -> findById -> findUnique
        .mockResolvedValueOnce(mockUserRecord as any); // no second call expected in this path
      prisma.user.update.mockResolvedValue(updated as any);

      const result = await service.update('user-1', { firstName: 'Updated' });

      expect(result.firstName).toBe('Updated');
    });

    it('fires USER_UPDATED hook', async () => {
      const updated = { ...mockUserRecord, isActive: false };
      prisma.user.findUnique.mockResolvedValue(mockUserRecord as any);
      prisma.user.update.mockResolvedValue(updated as any);

      await service.update('user-1', { isActive: false });

      expect(hooks.doAction).toHaveBeenCalledWith(
        expect.stringContaining('user.updated'),
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });
});
