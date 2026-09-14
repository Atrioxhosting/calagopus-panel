import { anyPausedUpload, anyStalledUpload } from '@/lib/files/stagingUploads.ts';
import { useFileManagerStore } from '@/stores/fileManager.ts';
import { useUploadsStore } from '@/stores/uploads.ts';

export default function useHasIncompleteUploads(): boolean {
  const serverUuid = useFileManagerStore((state) => state.externals.serverUuid);
  const anyStalled = useFileManagerStore((state) => anyStalledUpload(state.stagingUploads, state.stagingUploadsNow));
  const anyPaused = useUploadsStore((state) => anyPausedUpload(state.uploads, serverUuid));

  return anyStalled || anyPaused;
}
