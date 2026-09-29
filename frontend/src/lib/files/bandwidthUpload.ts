export const bandwidthUploadError = 'Bandwidth quota reached; files cannot be uploaded until the traffic quota resets.';

export function isBandwidthBlocked(state: string | undefined): boolean {
  return (
    state !== undefined &&
    ['quota_exceeded', 'stopping', 'stopped_quota', 'stop_failed', 'enforcement_unknown'].includes(state)
  );
}
