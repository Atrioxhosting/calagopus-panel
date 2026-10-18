import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { bytesProgressString } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { ExtensionUpload } from './useExtensionManagement.ts';

export default function ExtensionUploadsCard({
  uploads,
  onCancel,
}: {
  uploads: Map<number, ExtensionUpload>;
  onCancel: (id: number) => void;
}) {
  const { t } = useTranslations();

  if (uploads.size === 0) {
    return null;
  }

  return (
    <Card className='mb-4 flex flex-col gap-3'>
      {[...uploads].map(([id, upload]) => {
        const processing = upload.loaded >= upload.file.size;

        return (
          <div key={id} className='flex flex-row items-center'>
            <div className='flex flex-col grow min-w-0'>
              <div className='flex items-center gap-2 mb-1'>
                <Badge variant='light' size='sm' color={processing ? 'gray' : 'blue'}>
                  {processing
                    ? t('pages.admin.extensions.badge.processing', {})
                    : t('elements.fileUpload.badge.uploading', {})}
                </Badge>
                <span className='break-all text-sm'>{upload.file.name}</span>
              </div>
              <Tooltip label={bytesProgressString(upload.loaded, upload.file.size)} innerClassName='w-full'>
                <Progress
                  value={upload.file.size === 0 ? 100 : (upload.loaded / upload.file.size) * 100}
                  indeterminate={processing}
                />
              </Tooltip>
            </div>
            {!processing && (
              <Tooltip label={t('elements.fileUpload.cancel', {})}>
                <ActionIcon variant='light' color='red' className='ml-3' onClick={() => onCancel(id)}>
                  <FontAwesomeIcon icon={faXmark} size='sm' />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        );
      })}
    </Card>
  );
}
