import { basename, dirname } from 'pathe';
import statFiles from '@/api/server/files/statFiles.ts';

export interface FileRename {
  from: string;
  to: string;
}

export interface FileRenameResult {
  files: FileRename[];
  renamed: number;
}

interface FileRenameListener {
  before: (files: FileRename[]) => void;
  after: (result: FileRenameResult) => Promise<void>;
}
const listeners = new Map<string, Set<FileRenameListener>>();

export const registerFileRenameListener = (uuid: string, listener: FileRenameListener) => {
  let registered = listeners.get(uuid);
  if (!registered) {
    registered = new Set();
    listeners.set(uuid, registered);
  }
  registered.add(listener);

  return () => {
    registered.delete(listener);
    if (registered.size === 0) listeners.delete(uuid);
  };
};

export const validateFileRenames = (uuid: string, files: FileRename[]) => {
  for (const listener of listeners.get(uuid) ?? []) listener.before(files);
};

export const notifyFileRenames = async (uuid: string, result: FileRenameResult) => {
  await Promise.allSettled(Array.from(listeners.get(uuid) ?? [], (listener) => listener.after(result)));
};

export const isWithinRenamedPath = (path: string, parent: string) => path === parent || path.startsWith(`${parent}/`);

export const renameFilePath = (path: string, files: FileRename[]) =>
  files.reduce(
    (current, file) => (isWithinRenamedPath(current, file.from) ? file.to + current.slice(file.from.length) : current),
    path,
  );

export const resolveFileRenames = async (
  uuid: string,
  result: FileRenameResult,
  paths: string[],
): Promise<FileRename[]> => {
  if (result.renamed === 0) return [];
  if (result.renamed === result.files.length) return result.files;

  const candidates = result.files.filter((file) => paths.some((path) => isWithinRenamedPath(path, file.from)));
  if (candidates.length === 0) return [];

  const requested = new Map<string, Set<string>>();
  const request = (directory: string, name: string) => {
    let names = requested.get(directory);
    if (!names) {
      names = new Set();
      requested.set(directory, names);
    }
    names.add(name);
  };

  for (const file of candidates) {
    request(dirname(file.from), basename(file.from));
    request(dirname(file.to), basename(file.to));
  }

  const present = new Map<string, Set<string>>();
  await Promise.all(
    Array.from(requested, async ([directory, names]) => {
      try {
        const entries = await statFiles(uuid, directory, Array.from(names));
        present.set(directory, new Set(entries.map((entry) => entry.name)));
      } catch {
        // a directory that cannot be statted leaves its renames unresolved
      }
    }),
  );

  return candidates.filter((file) => {
    const source = present.get(dirname(file.from));
    const destination = present.get(dirname(file.to));
    if (!source || !destination) return false;

    return !source.has(basename(file.from)) && destination.has(basename(file.to));
  });
};

export const hasOverlappingFileRenames = (files: FileRename[]) =>
  files.some((file, index) =>
    files
      .slice(index + 1)
      .some((other) =>
        [other.from, other.to].some((path) =>
          [file.from, file.to].some(
            (candidate) => isWithinRenamedPath(path, candidate) || isWithinRenamedPath(candidate, path),
          ),
        ),
      ),
  );
