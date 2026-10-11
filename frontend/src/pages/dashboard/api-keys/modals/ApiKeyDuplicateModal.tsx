import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import duplicateApiKey from '@/api/me/api-keys/duplicateApiKey.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const duplicateApiKeySchema = z.object({
  name: z.string().min(3).max(31),
});

type Props = ModalProps & {
  apiKey: z.infer<typeof userApiKeySchema>;
  onDuplicated: (token: string) => void;
};

export default function ApiKeyDuplicateModal({ apiKey, onDuplicated, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof duplicateApiKeySchema>>({
    initialValues: {
      name: '',
    },
    schema: duplicateApiKeySchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      const { key } = await duplicateApiKey(apiKey.uuid, values.name);
      addToast(t('pages.account.apiKeys.modal.duplicateApiKey.toast.duplicated', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.user.apiKeys.all() });
      onDuplicated(key);
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = { name: `${apiKey.name} (copy)`.slice(0, 31) };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.account.apiKeys.modal.duplicateApiKey.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.newName', {})} {...form.getInputProps('name')} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
