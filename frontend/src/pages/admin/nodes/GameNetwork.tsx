import { Alert, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface NodeNetwork {
  prefix: string;
  reserved: string[];
}
export default function GameNetwork({ uuid }: { uuid: string }) {
  const { addToast } = useToast();
  const canUpdate = useAdminCan('nodes.update');
  const [prefix, setPrefix] = useState('');
  const [reserved, setReserved] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['node-game-network', uuid],
    queryFn: async () => (await axiosInstance.get<NodeNetwork | null>(`/api/admin/nodes/${uuid}/game-network`)).data,
  });
  useEffect(() => {
    if (query.data) {
      setPrefix(query.data.prefix);
      setReserved(query.data.reserved.join('\n'));
    }
  }, [query.data]);
  const save = async () => {
    setBusy(true);
    try {
      await axiosInstance.put(`/api/admin/nodes/${uuid}/game-network`, {
        prefix: prefix.trim(),
        reserved: reserved.split(/\s+/).filter(Boolean),
      });
      await query.refetch();
      addToast('Game IPv6 prefix saved.', 'success');
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack>
      <Text fw={600}>Native game IPv6</Text>
      <Alert>
        Use a globally routed /64 dedicated to this node. Infrastructure routing must be ready before game IPv6 is
        activated. Existing reservations prevent incompatible prefix changes.
      </Alert>
      {query.error && <Alert color='red'>{httpErrorToHuman(query.error)}</Alert>}
      <TextInput
        label='Dedicated game prefix (/64)'
        value={prefix}
        onChange={(event) => setPrefix(event.currentTarget.value)}
        disabled={!canUpdate}
      />
      <Textarea
        label='Reserved infrastructure addresses'
        description='One IPv6 address per line. Host IDs 0, 1 and the Docker gateway are always reserved.'
        value={reserved}
        onChange={(event) => setReserved(event.currentTarget.value)}
        disabled={!canUpdate}
      />
      {canUpdate && (
        <Button onClick={save} loading={busy} w='fit-content'>
          Save game network
        </Button>
      )}
    </Stack>
  );
}
