import { useMemo } from 'react';
import { collectIncompleteUploads, IncompleteUpload } from '@/lib/files/stagingUploads.ts';
import { useFileManagerStore } from '@/stores/fileManager.ts';
import { useUploadsStore } from '@/stores/uploads.ts';

export default function useIncompleteUploads(): IncompleteUpload[] {
  const serverUuid = useFileManagerStore((state) => state.externals.serverUuid);
  const now = useFileManagerStore((state) => state.stagingUploadsNow);
  const stagingUploads = useFileManagerStore((state) => state.stagingUploads);
  const localUploads = useUploadsStore((state) => state.uploads);

  return useMemo(
    () => collectIncompleteUploads(stagingUploads, now, localUploads, serverUuid),
    [stagingUploads, now, localUploads, serverUuid],
  );
}
