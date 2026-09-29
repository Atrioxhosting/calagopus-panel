import { useEffect, useState } from 'react';
import UploadConflictModal from '@/elements/files/UploadConflictModal.tsx';
import { UploadConflict, UploadConflictResolutions } from '@/lib/files/uploadConflicts.ts';
import { setUploadConflictResolver } from '@/lib/files/uploadManager.ts';
import { UploadDestination } from '@/stores/uploads.ts';

interface ConflictRequest {
  destination: Extract<UploadDestination, { type: 'server' }>;
  conflicts: UploadConflict[];
  remaining: number;
  resolve: (resolutions: UploadConflictResolutions | null) => void;
}

export default function UploadConflictHost() {
  const [queue, setQueue] = useState<ConflictRequest[]>([]);

  useEffect(() => {
    setUploadConflictResolver(
      (destination, conflicts, remaining) =>
        new Promise((resolve) => setQueue((prev) => [...prev, { destination, conflicts, remaining, resolve }])),
    );

    return () => setUploadConflictResolver(null);
  }, []);

  const [current] = queue;

  const finish = (resolutions: UploadConflictResolutions | null) => {
    current?.resolve(resolutions);
    setQueue((prev) => prev.slice(1));
  };

  return (
    <UploadConflictModal
      opened={!!current}
      directory={current?.destination.directory ?? '/'}
      conflicts={current?.conflicts ?? []}
      remaining={current?.remaining ?? 0}
      onResolve={finish}
      onClose={() => finish(null)}
    />
  );
}
