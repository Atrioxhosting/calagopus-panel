import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import Button from '@/elements/buttons/Button.tsx';
import ServerMultiSelect from '@/elements/input/ServerMultiSelect.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';

type Props = ModalProps & {
  serverGroup: z.infer<typeof userServerGroupSchema>;
  onServerAdded?: () => void;
};

export default function GroupAddServerModal({ serverGroup, onServerAdded, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);

  const [selectedServers, setSelectedServers] = useState<z.infer<typeof serverSchema>[]>([]);
  const [loading, setLoading] = useState(false);

  const serversToAdd = selectedServers.filter((server) => !serverGroup.serverOrder.includes(server.uuid));

  useEffect(() => {
    if (!props.opened) {
      setSelectedServers([]);
    }
  }, [props.opened]);

  const doAdd = () => {
    if (!serversToAdd.length) {
      return;
    }

    setLoading(true);

    const serverOrder = [...serverGroup.serverOrder, ...serversToAdd.map((server) => server.uuid)];

    updateServerGroup(serverGroup.uuid, { serverOrder })
      .then(() => {
        updateStateServerGroup(serverGroup.uuid, { serverOrder });

        onServerAdded?.();
        props.onClose();
        addToast(
          t('pages.account.home.tabs.groupedServers.page.modal.addServerToGroup.toast.added', {
            servers: tItem('server', serversToAdd.length),
          }),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('pages.account.home.tabs.groupedServers.page.modal.addServerToGroup.title', { group: serverGroup.name })}
      {...props}
    >
      <ServerMultiSelect
        withAsterisk
        label={t('common.form.servers', {})}
        exclude={serverGroup.serverOrder}
        withOthersSwitch
        value={selectedServers}
        onChange={setSelectedServers}
      />

      <ModalFooter>
        <Button onClick={doAdd} loading={loading} disabled={!serversToAdd.length}>
          {t('common.button.add', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
