function formatDecimal(value: number, units: readonly string[]): string {
  if (!Number.isFinite(value) || value <= 0) return `0 ${units[0]}`;

  const index = Math.min(Math.max(0, Math.floor(Math.log10(value) / 3)), units.length - 1);
  return `${index === 0 ? Number(value.toFixed(2)) : (value / 1000 ** index).toFixed(2)} ${units[index]}`;
}

/** Network counters are bytes; display traffic using decimal units. */
export function formatNetworkBytes(bytes: number): string {
  return formatDecimal(bytes, ['B', 'KB', 'MB', 'GB', 'TB']);
}

/** Network rates arrive in bytes/s; convert to bits/s only for display. */
export function formatNetworkRate(bytesPerSecond: number): string {
  return formatDecimal(bytesPerSecond * 8, ['bit/s', 'Kbit/s', 'Mbit/s', 'Gbit/s']);
}
