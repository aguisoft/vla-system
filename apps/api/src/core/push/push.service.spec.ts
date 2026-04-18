import { Test } from '@nestjs/testing';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HookService } from '../hooks/hook.service';
import * as webpush from 'web-push';

jest.mock('web-push');

const mockPrisma = {
  pushSubscription: {
    upsert:     jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany:   jest.fn().mockResolvedValue([]),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockHooks = {
  registerAction: jest.fn(),
};

describe('PushService', () => {
  let service: PushService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService,  useValue: mockPrisma },
        { provide: ConfigService,  useValue: { get: jest.fn().mockReturnValue(null) } },
        { provide: HookService,    useValue: mockHooks },
      ],
    }).compile();

    service = module.get(PushService);
    service.onModuleInit();
  });

  it('registers dashboards.new_leads hook listener on init', () => {
    expect(mockHooks.registerAction).toHaveBeenCalledWith(
      'dashboards.new_leads',
      expect.any(Function),
    );
  });

  it('subscribe upserts by endpoint', async () => {
    await service.subscribe('user-1', 'https://ep.example.com', 'p256dh', 'auth');
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where:  { endpoint: 'https://ep.example.com' },
      create: { userId: 'user-1', endpoint: 'https://ep.example.com', p256dh: 'p256dh', auth: 'auth' },
      update: { userId: 'user-1' },
    });
  });

  it('unsubscribe deletes by endpoint', async () => {
    await service.unsubscribe('https://ep.example.com');
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://ep.example.com' },
    });
  });

  it('sendToUser does nothing when no subscriptions', async () => {
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([]);
    await service.sendToUser('user-1', { title: 'T', body: 'B' });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('removes stale subscriptions on 410', async () => {
    (service as any).enabled = true;
    mockPrisma.pushSubscription.findMany.mockResolvedValueOnce([
      { endpoint: 'https://stale.example.com', p256dh: 'k', auth: 'a' },
    ]);
    const err: any = new Error('Gone'); err.statusCode = 410;
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce(err);

    await service.sendToUser('user-1', { title: 'T', body: 'B' });

    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://stale.example.com'] } },
    });
  });
});
