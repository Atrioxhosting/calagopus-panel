import Badge from '@/elements/data-display/Badge.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { backupRetentionRuleLabelMapping } from '@/lib/enums.ts';
import { ServerBackupRetentionStatus } from '@/lib/schemas/backupRetention.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface BackupRetentionStatusBadgeProps {
  status: ServerBackupRetentionStatus | null;
}

export default function BackupRetentionStatusBadge({ status }: BackupRetentionStatusBadgeProps) {
  const { t, tReact } = useTranslations();

  if (!status) {
    return null;
  }

  const ruleSummary = (rule: (typeof status.rules)[number]) =>
    t('common.elements.backupRetention.ruleSummary', {
      rule: backupRetentionRuleLabelMapping[rule](),
      count: status.retention[rule],
    });

  const badge = (() => {
    switch (status.state) {
      case 'retained':
        return (
          <Tooltip
            label={`${t('common.elements.backupRetention.status.keptBy', {
              rules: status.rules.map(ruleSummary).join(', '),
            })} ${t('common.elements.backupRetention.status.forecastDescription', {})}`}
            multiline
            maw={280}
          >
            <Badge className='w-max!' variant='light' color='blue'>
              {status.rule ? ruleSummary(status.rule) : t('common.elements.backupRetention.title', {})}
            </Badge>
          </Tooltip>
        );
      case 'locked':
        return (
          <Tooltip label={t('common.elements.backupRetention.status.lockedDescription', {})} multiline maw={280}>
            <Badge className='w-max!' variant='light' color='green'>
              {t('common.elements.backupRetention.status.locked', {})}
            </Badge>
          </Tooltip>
        );
      case 'indefinite':
        return (
          <Tooltip label={t('common.elements.backupRetention.status.indefiniteDescription', {})} multiline maw={280}>
            <Badge className='w-max!' variant='light' color='gray'>
              {t('common.elements.backupRetention.status.indefinite', {})}
            </Badge>
          </Tooltip>
        );
      case 'expired':
        return (
          <Tooltip label={t('common.elements.backupRetention.status.expiredDescription', {})} multiline maw={280}>
            <Badge className='w-max!' variant='light' color='yellow'>
              {t('common.elements.backupRetention.status.expired', {})}
            </Badge>
          </Tooltip>
        );
      case 'failed':
        return (
          <Tooltip label={t('common.elements.backupRetention.status.failedDescription', {})} multiline maw={280}>
            <Badge className='w-max!' variant='light' color='gray'>
              {t('common.elements.backupRetention.status.failed', {})}
            </Badge>
          </Tooltip>
        );
    }
  })();

  const showExpiry = status.state === 'retained' || status.state === 'failed';

  return (
    <div className='flex flex-col gap-0.5'>
      {badge}
      {showExpiry && (
        <span className='text-xs whitespace-nowrap text-(--mantine-color-dimmed)'>
          {status.expires
            ? tReact('common.elements.backupRetention.status.expires', {
                timestamp: <FormattedTimestamp timestamp={status.expires} tooltipClassName='inline-block' />,
              })
            : t('common.elements.backupRetention.status.expiresUnknown', {})}
        </span>
      )}
    </div>
  );
}
