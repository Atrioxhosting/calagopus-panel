/**
 * @deprecated `useAdminTableSelection` is now `@/plugins/selection/useTableSelection.ts`, which is
 * shared by admin and client tables. This re-export is kept for backward compatibility and will be
 * removed in a future release. Update imports to the new name.
 */
export {
  type TableSelection,
  useTableSelection as useAdminTableSelection,
} from '@/plugins/selection/useTableSelection.ts';
