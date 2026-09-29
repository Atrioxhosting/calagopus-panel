import { LazyString } from '@/lib/lazy.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export interface BackupColumnOptions {
  kind: boolean;
  source: boolean;
  files: boolean;
  retention: boolean;
  locked: boolean;
}

export interface BackupColumns extends BackupColumnOptions {
  headers: LazyString[];
  statusColSpan: number;
  progressColSpan: number;
}

export function getBackupColumns({ kind, source, files, retention, locked }: BackupColumnOptions): BackupColumns {
  return {
    kind,
    source,
    files,
    retention,
    locked,
    headers: [
      () => getTranslations().t('common.table.columns.name', {}),
      ...(kind ? [() => getTranslations().t('pages.server.backups.table.columns.kind', {})] : []),
      ...(source ? [() => getTranslations().t('common.table.columns.source', {})] : []),
      () => getTranslations().t('common.table.columns.checksum', {}),
      () => getTranslations().t('common.table.columns.size', {}),
      ...(files ? [() => getTranslations().t('common.table.columns.files', {})] : []),
      ...(retention ? [() => getTranslations().t('pages.server.backups.table.columns.retention', {})] : []),
      () => getTranslations().t('common.table.columns.created', {}),
      ...(locked ? [() => getTranslations().t('pages.server.backups.table.columns.locked', {})] : []),
      '',
    ],
    statusColSpan: files ? 3 : 2,
    progressColSpan: files ? 2 : 1,
  };
}
