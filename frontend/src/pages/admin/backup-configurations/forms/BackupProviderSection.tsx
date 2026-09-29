import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function BackupProviderSection({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Group gap='xs' wrap='nowrap' justify='space-between' align='center'>
          <Title order={2}>{title}</Title>
          {onRemove && (
            <ActionIcon color='gray' variant='subtle' aria-label={t('common.button.remove', {})} onClick={onRemove}>
              <FontAwesomeIcon icon={faXmark} />
            </ActionIcon>
          )}
        </Group>
        <Divider />
      </Stack>

      {children}
    </Stack>
  );
}
