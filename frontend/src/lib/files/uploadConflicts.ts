import { z } from 'zod';
import statFiles from '@/api/server/files/statFiles.ts';
import { uploadPathOf, withUploadPath } from '@/lib/files/uploadPaths.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';

type DirectoryEntry = z.infer<typeof serverDirectoryEntrySchema>;

const STAT_CHUNK_SIZE = 250;
const MAX_CHECKED_FILES = 1000;

export type UploadConflict =
  | { kind: 'file'; path: string; entry: DirectoryEntry; file: File }
  | { kind: 'folder'; path: string; entry: DirectoryEntry; files: number };

export interface UploadConflictResolutions {
  overwrite: string[];
  rename: Record<string, string>;
}

/**
 * Folders are checked by their top-level name rather than per file: a directory upload can carry
 * thousands of paths, which neither the request body nor the modal could hold.
 */
export async function findUploadConflicts(
  serverUuid: string,
  directory: string,
  files: File[],
): Promise<UploadConflict[]> {
  const individual = new Map<string, File>();
  const folders = new Map<string, number>();

  for (const file of files) {
    const path = uploadPathOf(file);
    const slash = path.indexOf('/');

    if (slash === -1) {
      individual.set(path, file);
    } else {
      const folder = path.slice(0, slash);
      folders.set(folder, (folders.get(folder) ?? 0) + 1);
    }
  }

  const names = Array.from(folders.keys());
  if (individual.size <= MAX_CHECKED_FILES) names.push(...individual.keys());
  if (names.length === 0) return [];

  const entries: DirectoryEntry[] = [];
  for (let i = 0; i < names.length; i += STAT_CHUNK_SIZE) {
    entries.push(...(await statFiles(serverUuid, directory, names.slice(i, i + STAT_CHUNK_SIZE))));
  }

  const conflicts: UploadConflict[] = [];
  for (const entry of entries) {
    const file = individual.get(entry.name);
    if (file) {
      conflicts.push({ kind: 'file', path: entry.name, entry, file });
      continue;
    }

    const count = folders.get(entry.name);
    if (count !== undefined) conflicts.push({ kind: 'folder', path: entry.name, entry, files: count });
  }

  return conflicts;
}

export function applyUploadResolutions(
  files: File[],
  conflicts: UploadConflict[],
  resolutions: UploadConflictResolutions | null,
): File[] {
  const overwrite = new Set(resolutions?.overwrite ?? []);
  const renames = resolutions?.rename ?? {};

  const conflictingFiles = new Set<string>();
  const conflictingFolders = new Set<string>();
  for (const conflict of conflicts) {
    (conflict.kind === 'file' ? conflictingFiles : conflictingFolders).add(conflict.path);
  }

  const resolved: File[] = [];
  for (const file of files) {
    const path = uploadPathOf(file);
    const slash = path.indexOf('/');
    const conflicting = slash === -1 ? conflictingFiles : conflictingFolders;
    const key = slash === -1 ? path : path.slice(0, slash);

    if (!conflicting.has(key) || overwrite.has(key)) {
      resolved.push(file);
      continue;
    }

    const renamed = renames[key];
    if (!renamed) continue;

    resolved.push(withUploadPath(file, slash === -1 ? renamed : renamed + path.slice(slash)));
  }

  return resolved;
}

export function generateUploadName(name: string): string {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot) : '';
  const base = dot > 0 ? name.slice(0, dot) : name;

  return `${base} copy${extension}`;
}
