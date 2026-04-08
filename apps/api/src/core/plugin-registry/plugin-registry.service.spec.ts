import { Test, TestingModule } from '@nestjs/testing';
import { PluginRegistryService } from './plugin-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';
import { VLAPlugin } from '@vla/shared';

const mockPlugin: VLAPlugin = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'A test plugin',
  adminOnly: false,
};

const mockDbRecord = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'A test plugin',
  route: null,
  icon: null,
  adminOnly: false,
  isActive: true,
  config: null,
  installedAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('PluginRegistryService', () => {
  let service: PluginRegistryService;
  let prisma: { plugin: jest.Mocked<{ findUnique: any; findMany: any; create: any; update: any }> };
  let hooks: jest.Mocked<Pick<HookService, 'doAction'>>;

  beforeEach(async () => {
    prisma = {
      plugin: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    hooks = { doAction: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginRegistryService,
        { provide: PrismaService, useValue: prisma },
        { provide: HookService, useValue: hooks },
      ],
    }).compile();

    service = module.get<PluginRegistryService>(PluginRegistryService);
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a new DB record and calls onInstall + onActivate for a fresh plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);
      prisma.plugin.create.mockResolvedValue(mockDbRecord as any);

      const onInstall = jest.fn().mockResolvedValue(undefined);
      const onActivate = jest.fn().mockResolvedValue(undefined);

      await service.register({ ...mockPlugin, onInstall, onActivate });

      expect(prisma.plugin.create).toHaveBeenCalled();
      expect(onInstall).toHaveBeenCalled();
      expect(onActivate).toHaveBeenCalled();
    });

    it('updates metadata and calls onActivate for an existing active plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ ...mockDbRecord, isActive: true } as any);
      prisma.plugin.update.mockResolvedValue(mockDbRecord as any);

      const onActivate = jest.fn().mockResolvedValue(undefined);

      await service.register({ ...mockPlugin, onActivate });

      expect(prisma.plugin.update).toHaveBeenCalled();
      expect(onActivate).toHaveBeenCalled();
    });

    it('does not call onActivate for an existing inactive plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ ...mockDbRecord, isActive: false } as any);
      prisma.plugin.update.mockResolvedValue(mockDbRecord as any);

      const onActivate = jest.fn();

      await service.register({ ...mockPlugin, onActivate });

      expect(onActivate).not.toHaveBeenCalled();
    });
  });

  // ─── activate / deactivate ────────────────────────────────────────────────

  describe('activate', () => {
    it('sets isActive=true in DB and fires PLUGIN_ACTIVATED hook', async () => {
      prisma.plugin.update.mockResolvedValue({ ...mockDbRecord, isActive: true } as any);

      const result = await service.activate('test-plugin');

      expect(prisma.plugin.update).toHaveBeenCalledWith({
        where: { name: 'test-plugin' },
        data: { isActive: true },
      });
      expect(hooks.doAction).toHaveBeenCalledWith(
        expect.stringContaining('plugin.activated'),
        { pluginName: 'test-plugin' },
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe('deactivate', () => {
    it('sets isActive=false in DB and fires PLUGIN_DEACTIVATED hook', async () => {
      prisma.plugin.update.mockResolvedValue({ ...mockDbRecord, isActive: false } as any);

      const result = await service.deactivate('test-plugin');

      expect(prisma.plugin.update).toHaveBeenCalledWith({
        where: { name: 'test-plugin' },
        data: { isActive: false },
      });
      expect(hooks.doAction).toHaveBeenCalledWith(
        expect.stringContaining('plugin.deactivated'),
        { pluginName: 'test-plugin' },
      );
      expect(result.isActive).toBe(false);
    });
  });

  // ─── getAll / getActive ───────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns mapped PluginRegistration array', async () => {
      prisma.plugin.findMany.mockResolvedValue([mockDbRecord] as any);

      const result = await service.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ name: 'test-plugin', version: '1.0.0' });
    });
  });

  describe('getActive', () => {
    it('queries only active plugins', async () => {
      prisma.plugin.findMany.mockResolvedValue([mockDbRecord] as any);

      await service.getActive();

      expect(prisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('isActive', () => {
    it('returns true when plugin record is active', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ ...mockDbRecord, isActive: true } as any);

      expect(await service.isActive('test-plugin')).toBe(true);
    });

    it('returns false when plugin is not found', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);

      expect(await service.isActive('missing')).toBe(false);
    });
  });
});
