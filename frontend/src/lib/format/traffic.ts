export function formatTrafficPercent(usedBytes: number, quotaBytes: number): string {
  const percent = (usedBytes / quotaBytes) * 100;
  return percent > 0 && percent < 0.01 ? '<0.01%' : `${percent.toFixed(2)}%`;
}

export type TrafficUnit = 'KB' | 'MB' | 'GB' | 'TB';

const trafficUnitDigits: Record<TrafficUnit, number> = { KB: 3, MB: 6, GB: 9, TB: 12 };

export function trafficCorrectionBytes(amount: number | string, unit: TrafficUnit): number | null {
  const text = String(amount).trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;

  const digits = trafficUnitDigits[unit];
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (fraction.length > digits) return null;

  const bytes = BigInt(match[1]) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  return bytes > 0n && bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : null;
}
