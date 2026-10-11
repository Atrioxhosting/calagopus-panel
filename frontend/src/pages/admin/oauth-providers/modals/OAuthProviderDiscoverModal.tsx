import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import discoverOAuthProvider from '@/api/admin/oauth-providers/discoverOAuthProvider.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminOAuthProviderDiscoverySchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function OAuthProviderDiscoverModal({
  onDiscovered,
  ...props
}: ModalProps & {
  onDiscovered: (provider: z.infer<typeof adminOAuthProviderDiscoverySchema>) => void;
}) {
  const { t } = useTranslations();

  const { form, handleClose, handleSubmit, loading } = useModalForm<{ url: string }>({
    initialValues: { url: '' },
    opened: props.opened,
    onClose: props.onClose,
    onSubmit: async ({ url }) => {
      onDiscovered(await discoverOAuthProvider(url));
    },
  });

  return (
    <FormModal
      title={t('pages.admin.oAuthProviders.tabs.general.page.modal.discover.title', {})}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.admin.oAuthProviders.tabs.general.page.modal.discover.url', {})}
          description={t('pages.admin.oAuthProviders.tabs.general.page.modal.discover.urlDescription', {})}
          placeholder='https://auth.example.com/realms/example'
          key={form.key('url')}
          {...form.getInputProps('url')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={form.getValues().url.length < 1}>
            {t('common.button.import', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
