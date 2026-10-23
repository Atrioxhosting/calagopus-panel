import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import debounce from 'debounce';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteAllocation from '@/api/server/allocations/deleteAllocation.ts';
import updateAllocation from '@/api/server/allocations/updateAllocation.ts';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { useRedactedAddress } from '@/plugins/privacy/useRedactAddresses.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface AllocationRowProps {
  allocation: z.infer<typeof serverAllocationSchema>;
  ipv6?: string;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

function AllocationValue({ value, redact = false }: { value: string; redact?: boolean }) {
  return (
    <CopyOnClick
      content={value}
      className='group inline-flex w-fit min-w-0 max-w-full items-center align-middle text-left leading-none focus-visible:outline-2! focus-visible:outline-solid! focus-visible:outline-(--mantine-primary-color-filled)!'
    >
      <Code
        className='block! max-w-full bg-(--mantine-color-default-hover)! transition-colors group-hover:bg-(--mantine-color-default-border)! group-focus-visible:bg-(--mantine-color-default-border)!'
        style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
      >
        {redact ? <RedactedText value={value} /> : value}
      </Code>
    </CopyOnClick>
  );
}

const AllocationRow = forwardRef<HTMLTableRowElement, AllocationRowProps>(function AllocationRow(
  { allocation, ipv6, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, updateServer } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      updateServer: state.updateServer,
    })),
  );
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);
  const displayAllocation = useRedactedAddress(`${allocation.ipAlias ?? allocation.ip}:${allocation.port}`);
  const [notes, setNotes] = useState(allocation.notes ?? '');
  const canUpdate = useServerCan('allocations.update');
  const canUnsetPrimary = !server.eggConfiguration?.allocationSelfAssignRequirePrimary;

  const setDebouncedNotes = useMemo(
    () =>
      debounce((notes: string) => {
        updateAllocation(server.uuid, allocation.uuid, { notes: notes || null })
          .then(() => {
            addToast(t('pages.server.network.toast.updated', {}), 'success');
            queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).network.all() });
          })
          .catch((msg) => {
            addToast(httpErrorToHuman(msg), 'error');
          });
      }, 500),
    [server.uuid, allocation.uuid, t, addToast, queryClient],
  );

  useEffect(() => {
    if (notes !== (allocation.notes ?? '')) {
      setDebouncedNotes(notes);
    }
  }, [notes]);

  const doSetPrimary = () => {
    updateAllocation(server.uuid, allocation.uuid, { primary: true })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).network.all() });
        updateServer({ allocation });
        addToast(t('pages.server.network.toast.setPrimary', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doUnsetPrimary = () => {
    if (!canUnsetPrimary) {
      return;
    }

    updateAllocation(server.uuid, allocation.uuid, { primary: false })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).network.all() });
        updateServer({ allocation: null });
        addToast(t('pages.server.network.toast.unsetPrimary', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRemove = async () => {
    await deleteAllocation(server.uuid, allocation.uuid)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).network.all() });
        addToast(t('pages.server.network.toast.removed', {}), 'success');
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.network.modal.removeAllocation.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.server.network.modal.removeAllocation.content', {
          allocation: displayAllocation,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faStar,
            label: t('common.button.setPrimary', {}),
            hidden: allocation.isPrimary,
            onClick: doSetPrimary,
            color: 'gray',
            canAccess: canUpdate,
          },
          {
            type: 'action',
            icon: faStar,
            label: t('common.button.unsetPrimary', {}),
            hidden: !allocation.isPrimary,
            disabled: !canUnsetPrimary,
            onClick: doUnsetPrimary,
            color: 'red',
            canAccess: canUpdate,
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useServerCan('allocations.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.network.allocationContextMenu}
        registryProps={{ allocation }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            className='[&>td]:align-middle'
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={allocation.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <td className='relative w-10 text-center'>
              {allocation.isPrimary && (
                <Tooltip label={t('common.tooltip.primary', {})}>
                  <FontAwesomeIcon icon={faStar} className='text-yellow-500 ml-3' />
                </Tooltip>
              )}
            </td>

            <TableData className='min-w-48 max-w-xs whitespace-normal!'>
              <Stack gap={4} className='min-w-0'>
                {allocation.ipAlias && (
                  <CopyOnClick content={allocation.ipAlias} className='max-w-full text-left [overflow-wrap:anywhere]'>
                    <Text size='sm' fw={500} component='span'>
                      <RedactedText value={allocation.ipAlias} />
                    </Text>
                  </CopyOnClick>
                )}
                <div className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1'>
                  <Text size='xs' c='dimmed'>
                    IPv4
                  </Text>
                  <AllocationValue value={allocation.ip} redact />
                  {ipv6 && (
                    <>
                      <Text size='xs' c='dimmed'>
                        IPv6
                      </Text>
                      <AllocationValue value={ipv6} redact />
                    </>
                  )}
                </div>
              </Stack>
            </TableData>

            <TableData>
              <AllocationValue value={String(allocation.port)} />
            </TableData>

            <TableData>
              <TextArea
                rows={Math.min(3, notes.split('\n').length)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('common.table.columns.notes', {})}
                disabled={!canUpdate}
                className='min-w-32'
              />
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={allocation.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default AllocationRow;
