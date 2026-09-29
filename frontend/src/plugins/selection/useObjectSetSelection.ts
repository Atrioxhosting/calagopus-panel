import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';

/**
 * @deprecated `useObjectSetSelection` is now `@/plugins/selection/useTableSelection.ts`, which takes
 * its options as an object. This wrapper is kept for backward compatibility and will be removed in a
 * future release. Update call sites to the new hook.
 */
export function useObjectSetSelection<T extends Record<'uuid', string>>(
  items: T[] | undefined,
  { shortcuts = true }: { shortcuts?: boolean } = {},
) {
  return useTableSelection<T>({ items, shortcuts });
}
