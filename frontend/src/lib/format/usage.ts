import { MantineColor } from '@mantine/core';

export function usagePercent(progress?: number | null, total?: number | null): number | null {
  return typeof progress === 'number' && typeof total === 'number' && total > 0
    ? Math.min(100, Math.max(0, (progress / total) * 100))
    : null;
}

const WARN_PERCENT = 80;
const DANGER_PERCENT = 95;

export function usagePercentColor(percent?: number | null): MantineColor | undefined {
  if (typeof percent !== 'number') return undefined;
  if (percent >= DANGER_PERCENT) return 'red';
  if (percent < WARN_PERCENT) return undefined;

  const ramp = ((percent - WARN_PERCENT) / (DANGER_PERCENT - WARN_PERCENT)) * 100;

  return `color-mix(in oklab, var(--mantine-color-red-filled) ${ramp.toFixed(1)}%, var(--mantine-color-yellow-filled))`;
}

export function usageColor(progress?: number | null, total?: number | null): MantineColor | undefined {
  return usagePercentColor(usagePercent(progress, total));
}

export function percentString(
  part: number | null | undefined,
  total: number | null | undefined,
  { digits = 2, whenEmpty = 0 }: { digits?: number; whenEmpty?: number } = {},
): string {
  if (typeof part !== 'number' || typeof total !== 'number' || total === 0) {
    return whenEmpty.toFixed(digits);
  }

  return ((part / total) * 100).toFixed(digits);
}
