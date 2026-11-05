import { faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Center, Stack, Text } from '@mantine/core';
import { makeComponentHookable } from 'shared';
import Button from '@/elements/buttons/Button.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

function ErrorState({ error, onRetry, retrying }: { error: string; onRetry?: () => void; retrying?: boolean }) {
  const { t } = useTranslations();

  return (
    <Center py='lg'>
      <Stack align='center' c='red' gap='xs'>
        <FontAwesomeIcon icon={faTriangleExclamation} size='3x' className='-mb-2' />
        <Text fw={500}>{t('common.alert.error', {})}</Text>
        <Text c='dimmed' size='sm' ta='center'>
          {error}
        </Text>
        {onRetry && (
          <Button
            variant='default'
            size='xs'
            mt='xs'
            loading={retrying}
            leftSection={<FontAwesomeIcon icon={faRotateRight} />}
            onClick={onRetry}
          >
            {t('common.button.retry', {})}
          </Button>
        )}
      </Stack>
    </Center>
  );
}

export default makeComponentHookable(ErrorState);
