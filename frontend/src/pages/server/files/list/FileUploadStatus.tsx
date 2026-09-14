import { BadgeProps } from '@mantine/core';
import Badge from '@/elements/data-display/Badge.tsx';
import { FileUploadState } from '@/pages/server/files/hooks/useFileUpload.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function FileUploadStatus({ upload, size }: { upload: FileUploadState; size: BadgeProps['size'] }) {
  const { t } = useTranslations();

  return (
    <>
      <Badge variant='light' size={size} color={upload.active ? 'green' : 'yellow'} className='w-max!'>
        {upload.active
          ? upload.percent === null
            ? t('elements.fileUpload.badge.uploading', {})
            : t('elements.fileUpload.badge.uploadingPercent', { percent: upload.percent.toFixed(0) })
          : t('elements.fileUpload.badge.incomplete', {})}
      </Badge>
      {upload.userName && !upload.own && (
        <span className='shrink-0 text-xs text-(--mantine-color-dimmed)'>
          {t('pages.server.files.upload.by', { user: upload.userName })}
        </span>
      )}
    </>
  );
}
