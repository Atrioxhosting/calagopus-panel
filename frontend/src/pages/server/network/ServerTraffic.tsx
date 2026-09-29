import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import { trafficBytesToString } from '@/lib/format/size.ts';
import { formatTrafficPercent } from '@/lib/format/traffic.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { useServerStore } from '@/stores/server.ts';
import NetworkSubNavigation from './NetworkSubNavigation.tsx';

export default function ServerTraffic() {
  const bandwidth = useServerStore((state) => state.stats?.bandwidth);
  const blocked =
    bandwidth &&
    ['quota_exceeded', 'stopping', 'stopped_quota', 'stop_failed', 'enforcement_unknown'].includes(bandwidth.state);

  return (
    <ServerContentContainer title='Traffic'>
      <NetworkSubNavigation />
      <p className='mt-4 text-sm text-(--mantine-color-dimmed)'>
        Your traffic usage includes both inbound and outbound traffic. Your monthly traffic quota is based on the amount
        of RAM allocated to your server. When the quota is reached, the server is stopped until the traffic quota resets
        or additional traffic is added.
      </p>
      {bandwidth && (
        <p className='mt-1 text-sm text-(--mantine-color-dimmed)'>
          The next traffic quota reset is on {formatDateTime(bandwidth.periodEnd * 1000)}.
        </p>
      )}
      {!bandwidth ? (
        <p className='mt-4'>Loading traffic usage...</p>
      ) : (
        <div className='space-y-4 mt-4'>
          {blocked && (
            <div className='rounded border border-red-500 p-4' role='alert'>
              Traffic quota reached. The server is stopped and normal starts are blocked until quota becomes available.
            </div>
          )}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <TitleCard title='Quota'>
              <p className='text-xl font-semibold tabular-nums'>
                {bandwidth.quotaBytes === null ? 'Unlimited' : trafficBytesToString(bandwidth.quotaBytes)}
              </p>
            </TitleCard>
            <TitleCard title='Used'>
              <p className='text-xl font-semibold tabular-nums'>
                {trafficBytesToString(bandwidth.usedBytes)}
                {bandwidth.quotaBytes !== null &&
                  bandwidth.quotaBytes > 0 &&
                  ` (${formatTrafficPercent(bandwidth.usedBytes, bandwidth.quotaBytes)})`}
              </p>
            </TitleCard>
            <TitleCard title='Inbound'>
              <p className='text-xl font-semibold tabular-nums'>{trafficBytesToString(bandwidth.rxBytes)}</p>
            </TitleCard>
            <TitleCard title='Outbound'>
              <p className='text-xl font-semibold tabular-nums'>{trafficBytesToString(bandwidth.txBytes)}</p>
            </TitleCard>
          </div>
        </div>
      )}
    </ServerContentContainer>
  );
}
