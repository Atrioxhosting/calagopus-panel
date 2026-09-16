import { z } from 'zod';

const MASK_CHARACTER = '*';

function maskOf(value: string): string {
  return MASK_CHARACTER.repeat([...value].length);
}

function normalize(value: string): string {
  return value
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
}

const ALWAYS_VISIBLE = new Set(['::', '::1', '127.0.0.1', '0.0.0.0', 'localhost']);

function isAlwaysVisible(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);

  return ALWAYS_VISIBLE.has(mapped ? mapped[1] : address);
}

export function isSensitiveAddress(value: string | null | undefined): boolean {
  const address = normalize(value ?? '');

  return address !== '' && !isAlwaysVisible(address);
}

export function maskAddress(value: string | null | undefined): string {
  if (!value) return '';

  const [host, port] = splitPort(value);

  return isSensitiveAddress(host) ? `${maskOf(host)}${port}` : value;
}

function splitPort(value: string): [string, string] {
  const bracketed = value.match(/^(\[[^\]]+\])(:\d+)$/);
  if (bracketed) return [bracketed[1], bracketed[2]];

  if (z.ipv6().safeParse(value).success) return [value, ''];

  const ported = value.match(/^(.+)(:\d+)$/);
  if (ported) return [ported[1], ported[2]];

  return [value, ''];
}

const ADDRESS_CANDIDATE = new RegExp(
  String.raw`(^|\x1b\[[\d;]*m|[^\w.])(?:((?:[0-9a-f]{0,4}:){2,7}(?:[0-9a-f]{1,4}|\d{1,3}(?:\.\d{1,3}){3})?)(?![\w:.])|((?:\d{1,3}\.){3}\d{1,3})(?![\w.]))`,
  'gi',
);

export function redactConsoleLine(line: string): string {
  return line.replace(ADDRESS_CANDIDATE, (match, lead, v6, v4) => {
    const address = v6 ?? v4;

    if (!isIpLiteral(address) || isAlwaysVisible(normalize(address))) return match;

    return `${lead}${maskOf(address)}`;
  });
}

function isIpLiteral(value: string): boolean {
  return z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success;
}
