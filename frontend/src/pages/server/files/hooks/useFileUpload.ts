import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isStalled, localTargetPath } from '@/lib/files/stagingUploads.ts';
import { usagePercent } from '@/lib/format/usage.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { stagingUploadPath, useFileManagerStore } from '@/stores/fileManager.ts';
import { UploadStatus, useUploadsStore } from '@/stores/uploads.ts';

export interface LocalUpload {
  key: string;
  uploaded: number;
  size: number;
  status: UploadStatus;
  resumable: boolean;
  detached: boolean;
}

export interface FileUploadState {
  targetName: string;
  uploaded: number;
  total: number | null;
  percent: number | null;
  active: boolean;
  userName: string | null;
  own: boolean;
  local: LocalUpload | null;
}

export default function useFileUpload(directory: string, name: string): FileUploadState | undefined {
  const path = stagingUploadPath(directory, name);
  const { user } = useAuth();
  const serverUuid = useFileManagerStore((state) => state.externals.serverUuid);
  const upload = useFileManagerStore((state) => state.stagingUploads.get(path));
  const stalled = useFileManagerStore((state) => {
    const staging = state.stagingUploads.get(path);
    return staging ? isStalled(staging, state.stagingUploadsNow) : false;
  });
  const targetPath = upload ? stagingUploadPath(upload.directory, upload.targetName) : null;
  const local = useUploadsStore(
    useShallow((state): LocalUpload | null => {
      if (!targetPath) return null;

      for (const [key, item] of state.uploads) {
        if (localTargetPath(item, serverUuid) !== targetPath) continue;

        return {
          key,
          uploaded: item.uploaded,
          size: item.size,
          status: item.status,
          resumable: item.resumable ?? false,
          detached: item.detached ?? false,
        };
      }

      return null;
    }),
  );

  return useMemo(() => {
    if (!upload) return undefined;

    const uploaded = local && !local.detached ? local.uploaded : upload.uploaded;
    const total = local && local.size > 0 ? local.size : upload.total;

    return {
      targetName: upload.targetName,
      uploaded,
      total,
      percent: usagePercent(uploaded, total),
      active: local ? local.status === 'uploading' || local.status === 'pending' : !stalled,
      userName: upload.userName,
      own: local !== null || (upload.user !== null && upload.user === user?.uuid),
      local,
    };
  }, [upload, stalled, local, user]);
}
