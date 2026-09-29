import { z } from 'zod';
import Badge from '@/elements/data-display/Badge.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { databaseAgentHostDeploymentStateInfo } from '@/lib/domain/databaseAgentHost.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useDatabaseAgentHostDeployment } from '@/plugins/database-agent-hosts/useDatabaseAgentHostDeployment.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DatabaseAgentHostDeploymentBadge({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const { state, usage } = useDatabaseAgentHostDeployment(databaseAgentHost);

  return (
    <Tooltip
      label={
        usage ? (
          <>
            <div>
              {usage.memory.limit === 0
                ? t('common.databaseAgentHost.deployment.memoryUsageUnlimited', {
                    used: bytesToString(mbToBytes(usage.memory.used)),
                  })
                : t('common.databaseAgentHost.deployment.memoryUsage', {
                    used: bytesToString(mbToBytes(usage.memory.used)),
                    limit: bytesToString(mbToBytes(usage.memory.limit)),
                  })}
            </div>
            <div>
              {usage.disk.limit === 0
                ? t('common.databaseAgentHost.deployment.diskUsageUnlimited', {
                    used: bytesToString(mbToBytes(usage.disk.used)),
                  })
                : t('common.databaseAgentHost.deployment.diskUsage', {
                    used: bytesToString(mbToBytes(usage.disk.used)),
                    limit: bytesToString(mbToBytes(usage.disk.limit)),
                  })}
            </div>
          </>
        ) : (
          databaseAgentHostDeploymentStateInfo[state].label()
        )
      }
    >
      <Badge color={databaseAgentHostDeploymentStateInfo[state].badgeColor} variant='light'>
        {databaseAgentHostDeploymentStateInfo[state].label()}
      </Badge>
    </Tooltip>
  );
}
