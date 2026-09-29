import { dump } from 'js-yaml';
import { z } from 'zod';
import {
  adminDatabaseAgentHostAllocatedCapacitySchema,
  adminDatabaseAgentHostSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const DATABASE_AGENT_DEFAULT_PORT = 8090;

export const DATABASE_AGENT_HOST_DEPLOYMENT_NEARLY_FULL_RATIO = 0.9;

export type DatabaseAgentHostDeploymentState =
  | 'disabled'
  | 'maintenance'
  | 'typesDisabled'
  | 'full'
  | 'nearlyFull'
  | 'available';

export const databaseAgentHostDeploymentStateInfo: Record<
  DatabaseAgentHostDeploymentState,
  { badgeColor: string; label: () => string }
> = {
  disabled: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.databaseAgentHost.deployment.disabled', {}),
  },
  maintenance: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.databaseAgentHost.deployment.maintenance', {}),
  },
  typesDisabled: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.databaseAgentHost.deployment.typesDisabled', {}),
  },
  full: {
    badgeColor: 'orange',
    label: () => getTranslations().t('common.databaseAgentHost.deployment.full', {}),
  },
  nearlyFull: {
    badgeColor: 'yellow',
    label: () => getTranslations().t('common.databaseAgentHost.deployment.nearlyFull', {}),
  },
  available: {
    badgeColor: 'green',
    label: () => getTranslations().t('common.databaseAgentHost.deployment.available', {}),
  },
};

export const getDatabaseAgentHostDeploymentUsage = (
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>,
  allocated: z.infer<typeof adminDatabaseAgentHostAllocatedCapacitySchema>,
) => ({
  memory: { used: allocated.memory, limit: databaseAgentHost.memory },
  disk: { used: allocated.disk, limit: databaseAgentHost.disk },
});

export const getDatabaseAgentHostDeploymentState = (
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>,
  allocated?: z.infer<typeof adminDatabaseAgentHostAllocatedCapacitySchema>,
): DatabaseAgentHostDeploymentState => {
  if (!databaseAgentHost.deploymentEnabled) return 'disabled';
  if (databaseAgentHost.maintenanceEnabled) return 'maintenance';
  if (!Object.values(databaseAgentHost.types).some((type) => type.enabled)) return 'typesDisabled';
  if (!allocated) return 'available';

  const ratios = Object.values(getDatabaseAgentHostDeploymentUsage(databaseAgentHost, allocated)).map(
    ({ used, limit }) => (limit === 0 ? 0 : used / limit),
  );
  const highest = Math.max(...ratios);

  if (highest >= 1) return 'full';
  if (highest >= DATABASE_AGENT_HOST_DEPLOYMENT_NEARLY_FULL_RATIO) return 'nearlyFull';

  return 'available';
};

interface DatabaseAgentHostConfigurationParams {
  token: string;
  apiPort: number;
}

export const getDatabaseAgentHostConfiguration = ({ token, apiPort }: DatabaseAgentHostConfigurationParams) => {
  return {
    api: {
      bind: `0.0.0.0:${apiPort}`,
      token,
    },
  };
};

export const getDatabaseAgentHostConfigurationCommand = (params: DatabaseAgentHostConfigurationParams) => {
  const config = getDatabaseAgentHostConfiguration(params);
  const yaml = dump(config, {
    flowSkipCommaSpace: true,
    flowSkipColonSpace: true,
    quoteFlowKeys: true,
    indent: 1,
    seqNoIndent: true,
  });
  return `calagopus-db-agent configure --join-data ${btoa(yaml)}`;
};
