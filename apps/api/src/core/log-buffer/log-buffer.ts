import { Response } from 'express';

export interface LogEntry {
  id: number;
  ts: string;
  level: string;
  msg: string;
  context?: string;
}

const LEVEL_MAP: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const MAX_ENTRIES = 500;

export class LogBuffer {
  private static entries: LogEntry[] = [];
  private static counter = 0;
  private static clients: Set<Response> = new Set();
  private static initialized = false;

  static init(): void {
    if (LogBuffer.initialized) return;
    LogBuffer.initialized = true;

    const originalWrite = process.stdout.write.bind(process.stdout);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = function (
      chunk: string | Uint8Array,
      encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
      cb?: (err?: Error | null) => void,
    ): boolean {
      const result =
        typeof encodingOrCb === 'function'
          ? originalWrite(chunk, encodingOrCb)
          : cb
            ? originalWrite(chunk, encodingOrCb as BufferEncoding, cb)
            : originalWrite(chunk as string, encodingOrCb as BufferEncoding);

      const raw = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      const lines = raw.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed[0] !== '{') continue;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          if (typeof parsed.level !== 'number' || typeof parsed.msg !== 'string') continue;

          const entry: LogEntry = {
            id: ++LogBuffer.counter,
            ts: typeof parsed.time === 'number'
              ? new Date(parsed.time).toISOString()
              : new Date().toISOString(),
            level: LEVEL_MAP[parsed.level as number] ?? String(parsed.level),
            msg: parsed.msg,
            context: typeof parsed.context === 'string' ? parsed.context : undefined,
          };

          LogBuffer.entries.push(entry);
          if (LogBuffer.entries.length > MAX_ENTRIES) {
            LogBuffer.entries.shift();
          }

          LogBuffer.broadcast(entry);
        } catch {
          // not a JSON line — ignore
        }
      }

      return result;
    };
  }

  static getEntries(limit = 200): LogEntry[] {
    const all = [...LogBuffer.entries].reverse();
    return limit > 0 ? all.slice(0, limit) : all;
  }

  static subscribe(res: Response): void {
    LogBuffer.clients.add(res);
  }

  static unsubscribe(res: Response): void {
    LogBuffer.clients.delete(res);
  }

  private static broadcast(entry: LogEntry): void {
    if (LogBuffer.clients.size === 0) return;
    const data = `data: ${JSON.stringify(entry)}\n\n`;
    for (const client of LogBuffer.clients) {
      try {
        client.write(data);
      } catch {
        LogBuffer.clients.delete(client);
      }
    }
  }
}
