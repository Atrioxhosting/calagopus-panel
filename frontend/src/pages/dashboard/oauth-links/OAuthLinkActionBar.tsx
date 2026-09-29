import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteOAuthLink from '@/api/me/oauth-links/deleteOAuthLink.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function OAuthLinkActionBar({
  selectedOAuthLinks,
  clearSelection,
  onFinished,
}: {
  selectedOAuthLinks: ObjectSet<z.infer<typeof userOAuthLinkSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const oauthLinks = selectedOAuthLinks.values();

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDelete = () => {
    setConfirming(false);

    run({
      action: 'delete',
      items: oauthLinks,
      itemKey: 'oauthLink',
      verb: t('common.bulkActions.verb.removed', {}),
      request: (oauthLink) => deleteOAuthLink(oauthLink.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.oauthLinks.modal.deleteOAuthLinks.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.oauthLinks.modal.deleteOAuthLinks.content', {
          oauthLinks: tItem('oauthLink', oauthLinks.length),
        }).md()}
      </ConfirmationModal>

      <ActionBar opened={selectedOAuthLinks.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.actionBar.prependedComponents
          }
          name='oauthLinks-actionBar-prepended'
        />

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'delete'}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.remove', {})} ({oauthLinks.length})
        </Button>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.actionBar.appendedComponents}
          name='oauthLinks-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
