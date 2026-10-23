import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Code, CopyButton, Group, Stack, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';

interface NetworkStatus {
  address: string | null;
  applied_address: string | null;
  pending: boolean;
  retry_after_seconds: number;
  error: string | null;
}
export function useGameIpv6(uuid: string, admin = false, enabled = true) {
  return useQuery({
    queryKey: ['game-ipv6', admin ? 'admin' : 'client', uuid],
    queryFn: async () =>
      (await axiosInstance.get<NetworkStatus>(`/api/${admin ? 'admin' : 'client'}/servers/${uuid}/game-network`)).data,
    enabled,
    refetchInterval: 5000,
  });
}
export default function GameIpv6({
  uuid,
  admin = false,
  canChange,
}: {
  uuid: string;
  admin?: boolean;
  canChange: boolean;
}) {
  const query = useGameIpv6(uuid, admin);
  const { user } = useAuth();
  const unlimited = admin || user?.admin === true;
  const { addToast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [address, setAddress] = useState('');
  const network = query.data;
  const currentAddress = network?.applied_address ?? network?.address;
  const unconfigured =
    network &&
    !currentAddress &&
    !network.pending &&
    (!network.error || network.error === 'The node has no game IPv6 prefix configured');
  const rotate = async () => {
    try {
      await axiosInstance.post(
        `/api/${admin ? 'admin' : 'client'}/servers/${uuid}/game-network`,
        admin && address.trim() ? { address: address.trim() } : {},
      );
      setConfirm(false);
      setAddress('');
      await query.refetch();
      addToast(
        'IPv6 change reserved. The network will be reconciled before the previous address is released.',
        'success',
      );
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }
  };
  return (
    <Card p='md' mb='md' className='min-w-0'>
      <Stack gap='sm'>
        <Group justify='space-between' gap='sm'>
          <Text fw={600}>Dedicated IPv6</Text>
          {network && canChange && (
            <Button
              size='xs'
              className='shrink-0'
              leftSection={<FontAwesomeIcon icon={faRotate} />}
              disabled={!network.address || network.pending || (!unlimited && network.retry_after_seconds > 0)}
              onClick={() => setConfirm(true)}
            >
              Rotate IPv6
            </Button>
          )}
        </Group>
        {query.error && <Alert color='red'>{httpErrorToHuman(query.error)}</Alert>}
        {network && (
          <>
            {admin && currentAddress && (
              <Group wrap='nowrap' gap='sm'>
                <Code className='min-w-0 flex-1' style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  {currentAddress}
                </Code>
                <CopyButton value={currentAddress}>
                  {({ copied, copy }) => (
                    <Button size='xs' variant='default' className='shrink-0' onClick={copy}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            )}
            {unconfigured && (
              <Alert color='gray' p='xs'>
                No game IPv6 prefix is configured for this node.
              </Alert>
            )}
            {network.pending && (
              <Alert color='yellow' style={{ overflowWrap: 'anywhere' }}>
                Network change pending: {network.address}. The previous address remains reserved until the new state is
                confirmed.
              </Alert>
            )}
            {network.error && !unconfigured && <Alert color='red'>{network.error}</Alert>}
            {!unlimited && network.retry_after_seconds > 0 && (
              <Text size='sm' c='dimmed'>
                Next rotation in {Math.ceil(network.retry_after_seconds / 60)} minutes.
              </Text>
            )}
            {admin && canChange && (
              <TextInput
                label='Replacement IPv6 address'
                description='Leave empty to generate a new random address from the node game prefix.'
                value={address}
                onChange={(event) => setAddress(event.currentTarget.value)}
              />
            )}
          </>
        )}
        <Stack gap={2}>
          <Text size='sm' c={admin ? 'dimmed' : undefined}>
            {admin
              ? 'Shared across all allocations on this server.'
              : 'Your IPv4 address is shared with other game servers. Your IPv6 address is yours alone, so no other game server uses it.'}
          </Text>
          <Text size='sm' c='dimmed'>
            {admin
              ? 'Rotating this address will restart the game server.'
              : 'Changing your IPv6 address will restart your game server.'}
          </Text>
        </Stack>
      </Stack>
      <ConfirmationModal opened={confirm} onClose={() => setConfirm(false)} title='Rotate IPv6' onConfirmed={rotate}>
        This changes the IPv6 address and will restart the game server and disconnect players. Update any DNS AAAA
        records after the change. IPv4 allocations and ports remain unchanged. Continue?
      </ConfirmationModal>
    </Card>
  );
}
