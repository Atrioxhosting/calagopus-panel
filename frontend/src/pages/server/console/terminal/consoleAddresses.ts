import { z } from 'zod';

const ipv4 = z.ipv4();
const ipv6 = z.ipv6();

export interface ConsoleAddress {
  start: number;
  end: number;
  value: string;
  mask: string;
}

/** Run on parsed terminal text, so ANSI sequences cannot split an address. */
export function findConsoleAddresses(text: string): ConsoleAddress[] {
  const addresses: ConsoleAddress[] = [];
  const candidates =
    /(?<![\w.])(?:(?=[\da-f]|::)(?:[\da-f]{0,4}:){2,7}(?:(?:\d{1,3}\.){3}\d{1,3}|[\da-f]{1,4})?(?:%[\w.-]+)?(?![\w:]|\.[\w.])|(?:\d{1,3}\.){3}\d{1,3}(?!\w|\.[\w.]))/gi;
  for (const match of text.matchAll(candidates)) {
    const value = match[0];
    const start = match.index;
    const v6 = ipv6.safeParse(value.split('%')[0]).success;
    if (!v6 && !ipv4.safeParse(value).success) continue;
    addresses.push({ start, end: start + value.length, value, mask: v6 ? 'x:x:x:x:x:x:x:x' : 'x.x.x.x' });
  }
  return addresses;
}
