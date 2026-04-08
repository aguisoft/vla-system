import { Test, TestingModule } from '@nestjs/testing';
import { HookService } from './hook.service';

describe('HookService', () => {
  let service: HookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookService],
    }).compile();

    service = module.get<HookService>(HookService);
  });

  // ─── Actions ────────────────────────────────────────────────────────────────

  describe('registerAction / doAction', () => {
    it('calls registered handler with payload', async () => {
      const handler = jest.fn();
      service.registerAction('test.action', handler);

      await service.doAction('test.action', { value: 42 });

      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });

    it('calls handlers in priority order', async () => {
      const order: number[] = [];
      service.registerAction('order.action', () => { order.push(2); }, { priority: 20 });
      service.registerAction('order.action', () => { order.push(1); }, { priority: 5 });
      service.registerAction('order.action', () => { order.push(3); }, { priority: 50 });

      await service.doAction('order.action', {});

      expect(order).toEqual([1, 2, 3]);
    });

    it('does not throw when no handlers are registered', async () => {
      await expect(service.doAction('unregistered', {})).resolves.toBeUndefined();
    });

    it('isolates handler errors and continues execution', async () => {
      const after = jest.fn();
      service.registerAction('error.action', () => { throw new Error('boom'); }, { priority: 1 });
      service.registerAction('error.action', after, { priority: 2 });

      await service.doAction('error.action', {});

      expect(after).toHaveBeenCalled();
    });

    it('awaits async handlers', async () => {
      let resolved = false;
      service.registerAction('async.action', async () => {
        await Promise.resolve();
        resolved = true;
      });

      await service.doAction('async.action', {});

      expect(resolved).toBe(true);
    });
  });

  // ─── Filters ────────────────────────────────────────────────────────────────

  describe('registerFilter / applyFilter', () => {
    it('transforms the value through a single handler', async () => {
      service.registerFilter<number>('double', (n) => n * 2);

      const result = await service.applyFilter('double', 5);

      expect(result).toBe(10);
    });

    it('chains multiple handlers in priority order', async () => {
      service.registerFilter<number>('chain', (n) => n + 10, { priority: 20 });
      service.registerFilter<number>('chain', (n) => n * 2, { priority: 5 });

      // priority 5 runs first: 3 * 2 = 6; then priority 20: 6 + 10 = 16
      const result = await service.applyFilter('chain', 3);

      expect(result).toBe(16);
    });

    it('returns original value when no handlers are registered', async () => {
      const result = await service.applyFilter('empty.filter', { x: 1 });

      expect(result).toEqual({ x: 1 });
    });

    it('skips a failing handler and passes last good value to the next', async () => {
      service.registerFilter<number>('error.filter', () => { throw new Error('bad'); }, { priority: 1 });
      service.registerFilter<number>('error.filter', (n) => n + 1, { priority: 2 });

      // failing handler is skipped; value stays 5; then +1 = 6
      const result = await service.applyFilter('error.filter', 5);

      expect(result).toBe(6);
    });
  });

  // ─── Introspection ──────────────────────────────────────────────────────────

  describe('getRegisteredHooks', () => {
    it('lists registered action and filter hook names', () => {
      service.registerAction('my.action', jest.fn());
      service.registerFilter('my.filter', (v) => v);

      const { actions, filters } = service.getRegisteredHooks();

      expect(actions).toContain('my.action');
      expect(filters).toContain('my.filter');
    });
  });
});
