import Badge from '@/elements/data-display/Badge.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { NodeAllowedSourceKind, useNodeAllowedSource } from '@/plugins/nodes/useNodeAllowedSource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeAllowedSourceBadge({
  nodeUuid,
  kind,
  uuid,
}: {
  nodeUuid: string;
  kind: NodeAllowedSourceKind;
  uuid: string;
}) {
  const { t } = useTranslations();
  const { allowed, loading } = useNodeAllowedSource(nodeUuid, kind, uuid);

  if (loading) {
    return (
      <Badge loading className='w-max!'>
        {t('common.node.allowedSources.checking', {})}
      </Badge>
    );
  }

  if (allowed !== false) {
    return null;
  }

  return (
    <Tooltip
      label={
        kind === 'mount'
          ? t('common.node.allowedSources.mountNotAllowed', {}).md()
          : t('common.node.allowedSources.deviceNotAllowed', {}).md()
      }
    >
      <Badge color='red' className='w-max!'>
        {t('common.node.allowedSources.notAllowed', {})}
      </Badge>
    </Tooltip>
  );
}
