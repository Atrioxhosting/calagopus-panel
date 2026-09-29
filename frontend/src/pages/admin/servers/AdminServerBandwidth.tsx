import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import correctServerBandwidth from '@/api/admin/servers/correctServerBandwidth.ts';
import getServerBandwidth, { adminBandwidthSchema } from '@/api/admin/servers/getServerBandwidth.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import { trafficBytesToString } from '@/lib/format/size.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { formatTrafficPercent, TrafficUnit, trafficCorrectionBytes } from '@/lib/format/traffic.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className='min-w-0'>
      <p className='text-sm text-(--mantine-color-dimmed)'>{label}</p>
      <p className='mt-1 text-lg font-semibold tabular-nums break-words'>{value}</p>
    </Card>
  );
}

function bandwidthStatus(state: string): string {
  switch (state) {
    case 'active':
      return 'Active';
    case 'quota_exceeded':
      return 'Quota reached';
    case 'stopping':
      return 'Stopping due to quota';
    case 'stopped_quota':
      return 'Stopped due to quota';
    case 'stop_failed':
      return 'Quota stop failed';
    case 'enforcement_unknown':
      return 'Enforcement unavailable';
    default:
      return state.replaceAll('_', ' ');
  }
}

export default function AdminServerBandwidth({ server }: { server: AdminServer }) {
  const [usage, setUsage] = useState<z.infer<typeof adminBandwidthSchema> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>('');
  const [unit, setUnit] = useState<TrafficUnit>('GB');
  const [working, setWorking] = useState(false);
  const pendingCorrection = useRef<{ delta: number; id: string } | null>(null);
  const { addToast } = useToast();
  const bytes = trafficCorrectionBytes(amount, unit);

  const refresh = () =>
    getServerBandwidth(server.uuid)
      .then((data) => {
        setUsage(data);
        setError(null);
      })
      .catch((err) => setError(httpErrorToHuman(err)));
  useEffect(() => {
    void refresh();
  }, [server.uuid]);

  const correct = async (direction: 1 | -1) => {
    if (bytes === null) return;
    if (direction === -1 && usage && bytes > usage.usedBytes) {
      addToast('The amount to subtract cannot exceed the current bandwidth usage.', 'error');
      return;
    }
    const delta = direction * bytes;
    setWorking(true);
    try {
      if (!pendingCorrection.current || pendingCorrection.current.delta !== delta) {
        pendingCorrection.current = { delta, id: crypto.randomUUID() };
      }
      await correctServerBandwidth(server.uuid, pendingCorrection.current.id, delta);
      await refresh();
      pendingCorrection.current = null;
      setAmount('');
      addToast('Bandwidth usage corrected', 'success');
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className='space-y-4 p-4'>
      <h2 className='text-lg font-semibold'>Bandwidth</h2>
      {error && <p role='alert'>{error}</p>}
      {usage && (
        <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
          <MetricCard
            label='Quota'
            value={usage.quotaBytes === null ? 'Unlimited' : trafficBytesToString(usage.quotaBytes)}
          />
          <MetricCard
            label='Used'
            value={
              <>
                {trafficBytesToString(usage.usedBytes)}
                {usage.quotaBytes !== null &&
                  usage.quotaBytes > 0 &&
                  ` (${formatTrafficPercent(usage.usedBytes, usage.quotaBytes)})`}
              </>
            }
          />
          <MetricCard label='Inbound' value={trafficBytesToString(usage.rxBytes)} />
          <MetricCard label='Outbound' value={trafficBytesToString(usage.txBytes)} />
          <MetricCard
            label='Bandwidth per GiB'
            value={usage.bandwidthPerGib === 0 ? 'Unlimited' : `${usage.bandwidthPerGib} GB`}
          />
          <MetricCard label='Resume after quota' value={usage.resumeAfterQuota ? 'Yes' : 'No'} />
          <MetricCard label='Status' value={bandwidthStatus(usage.state)} />
          <MetricCard label='Last checkpoint' value={formatDateTime(usage.lastCheckpoint)} />
        </div>
      )}
      <div className='flex flex-wrap items-end gap-2'>
        <NumberInput
          label='Usage correction'
          value={amount}
          onChange={setAmount}
          allowNegative={false}
          decimalScale={unit === 'KB' ? 3 : unit === 'MB' ? 6 : unit === 'GB' ? 9 : 12}
          min={0}
          className='min-w-40 flex-1'
        />
        <Select
          label='Unit'
          value={unit}
          onChange={(value) => setUnit((value ?? 'GB') as TrafficUnit)}
          data={['KB', 'MB', 'GB', 'TB']}
          className='w-24'
        />
        <Button onClick={() => correct(1)} loading={working} disabled={!usage || bytes === null}>
          Add
        </Button>
        <Button onClick={() => correct(-1)} loading={working} disabled={!usage || bytes === null}>
          Subtract
        </Button>
      </div>
    </div>
  );
}
