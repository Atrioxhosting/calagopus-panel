type LockedValue = { present: false } | { present: true; value: unknown };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && deepEqual(a[key], b[key]));
  }

  return false;
};

// Mirrors the backend's strip_config_paths: a non-object parent of a locked path is dropped as a whole.
const lockedValue = (config: unknown, path: string): LockedValue => {
  let cursor = config;
  const parts = path.split('.');

  for (const [index, part] of parts.entries()) {
    if (!isPlainObject(cursor) || !(part in cursor)) return { present: false };

    const next = cursor[part];
    if (index === parts.length - 1 || !isPlainObject(next)) return { present: true, value: next };

    cursor = next;
  }

  return { present: false };
};

export function findChangedLockedPaths(lockedPaths: string[], before: unknown, after: unknown): string[] {
  const changed = lockedPaths.filter((path) => {
    const next = lockedValue(after, path);
    if (!next.present) return false;

    const previous = lockedValue(before, path);
    return !previous.present || !deepEqual(previous.value, next.value);
  });

  return changed.filter((path) => !changed.some((other) => path.startsWith(`${other}.`)));
}
