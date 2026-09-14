import { join } from 'pathe';
import { useCallback, useEffect, useRef } from 'react';
import { z } from 'zod';
import { startStagingUploadsClock } from '@/lib/files/stagingUploads.ts';
import { serverDirectoryUploadSchema } from '@/lib/schemas/server/files.ts';
import { safeParseFromApi } from '@/lib/serialization/api-transform.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';

const uploadsSchema = z.array(serverDirectoryUploadSchema);

const DIRECTORY_REFRESH_FLOOR_MS = 3_000;

export default function useFileUploadSocket() {
  const store = useFileManagerApi();
  const serverUuid = useFileManagerStore((state) => state.externals.serverUuid);
  const knownNames = useRef(new Map<string, string>());
  const lastRefreshed = useRef(new Map<string, number>());
  const latestNames = useRef(new Map<string, string[]>());
  const flushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (flushTimeout.current !== null) {
      clearTimeout(flushTimeout.current);
      flushTimeout.current = null;
    }

    const now = Date.now();
    const changed: string[] = [];
    let retryIn: number | null = null;

    for (const [directory, directoryNames] of latestNames.current) {
      const signature = directoryNames.sort().join('\n');
      if (signature === knownNames.current.get(directory)) continue;

      const sinceRefresh = now - (lastRefreshed.current.get(directory) ?? 0);
      if (sinceRefresh < DIRECTORY_REFRESH_FLOOR_MS) {
        const wait = DIRECTORY_REFRESH_FLOOR_MS - sinceRefresh;
        if (retryIn === null || wait < retryIn) retryIn = wait;
        continue;
      }

      if (directoryNames.length === 0) {
        knownNames.current.delete(directory);
        lastRefreshed.current.delete(directory);
        latestNames.current.delete(directory);
      } else {
        knownNames.current.set(directory, signature);
        lastRefreshed.current.set(directory, now);
      }

      changed.push(directory);
    }

    store.getState().refreshDirectories(changed);

    if (retryIn !== null) flushTimeout.current = setTimeout(flush, retryIn);
  }, [store]);

  useEffect(() => {
    knownNames.current = new Map();
    lastRefreshed.current = new Map();
    latestNames.current = new Map();

    return () => {
      if (flushTimeout.current !== null) clearTimeout(flushTimeout.current);
      flushTimeout.current = null;
    };
  }, [serverUuid]);

  useEffect(() => startStagingUploadsClock(store), [store]);

  useWebsocketEvent(SocketEvent.FILE_UPLOADS, (data) => {
    let wsData: unknown;
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    const result = safeParseFromApi(uploadsSchema, wsData);
    if (!result.success) return;

    store.getState().setStagingUploads(result.data);

    const names = new Map<string, string[]>();
    for (const upload of result.data) {
      const directory = join('/', upload.directory);
      const directoryNames = names.get(directory);
      if (directoryNames) directoryNames.push(upload.name);
      else names.set(directory, [upload.name]);
    }
    for (const directory of knownNames.current.keys()) {
      if (!names.has(directory)) names.set(directory, []);
    }

    latestNames.current = names;
    flush();
  });
}
