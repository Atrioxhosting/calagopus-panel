import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findConsoleAddresses } from './consoleAddresses.ts';

const values = (text: string) => findConsoleAddresses(text).map((a) => a.value);

test('recognizes IPv4, ports, local and unspecified addresses without exemptions', () => {
  assert.deepEqual(values('192.0.2.10:25565 127.0.0.1 0.0.0.0 255.255.255.255'), [
    '192.0.2.10',
    '127.0.0.1',
    '0.0.0.0',
    '255.255.255.255',
  ]);
});

test('recognizes full, compressed, mapped and scoped IPv6 without consuming ports', () => {
  assert.deepEqual(
    values('[2001:db8::1]:25565 :: ::1 2001:0db8:0000:0000:0000:0000:0000:0001 ::ffff:192.0.2.1 fe80::1%eth0'),
    ['2001:db8::1', '::', '::1', '2001:0db8:0000:0000:0000:0000:0000:0001', '::ffff:192.0.2.1', 'fe80::1%eth0'],
  );
});

test('keeps punctuation and surrounding text outside matched ranges', () => {
  const text = '玩家 ip=192.0.2.1, [2001:db8::2]:80!';
  const matches = findConsoleAddresses(text);
  assert.deepEqual(
    matches.map((a) => text.slice(a.start, a.end)),
    ['192.0.2.1', '2001:db8::2'],
  );
  assert.deepEqual(
    matches.map((a) => a.mask),
    ['x.x.x.x', 'x:x:x:x:x:x:x:x'],
  );
});

test('rejects invalid addresses, timestamps and version identifiers', () => {
  assert.deepEqual(
    values('12:34:56 2026-10-23T12:34:56 v1.2.3 1.2.3 v1.2.3.4 1.2.3.4.5 256.2.3.4 01.2.3.4 2001:db8:::1 12345::1'),
    [],
  );
});

test('does not mutate source data or retain occurrence state', () => {
  const text = '192.0.2.1 192.0.2.1';
  const first = findConsoleAddresses(text);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].start, first[1].start);
  first[0].value = 'changed';
  assert.deepEqual(values(text), ['192.0.2.1', '192.0.2.1']);
  assert.equal(text, '192.0.2.1 192.0.2.1');
});

test('recognizes addresses before sentence punctuation and after log labels', () => {
  assert.deepEqual(values('ip:2001:db8::1. ip:192.0.2.1. IPv6=::1.'), ['2001:db8::1', '192.0.2.1', '::1']);
});
