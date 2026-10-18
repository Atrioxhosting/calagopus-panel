import { Anchor } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NestCreateModal from './modals/NestCreateModal.tsx';

export function NestCreateHint({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations();
  const canCreateNests = useAdminCan('nests.create');

  if (!canCreateNests) {
    return null;
  }

  return (
    <Anchor component='button' type='button' size='sm' onClick={onClick}>
      {t('common.form.nestCreateHint', {})}
    </Anchor>
  );
}

interface NestCreateFieldProps {
  onCreated: (nest: z.infer<typeof adminNestSchema>) => void;
}

export default function NestCreateField({ onCreated }: NestCreateFieldProps) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <NestCreateModal
        opened={opened}
        onClose={() => setOpened(false)}
        onCreated={(nest) => {
          setOpened(false);
          onCreated(nest);
        }}
      />
      <NestCreateHint onClick={() => setOpened(true)} />
    </>
  );
}
