import { Anchor } from '@mantine/core';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggInstallField({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations();
  const canInstall = useAdminCan(['eggs.create', 'egg-repositories.read'], false);

  if (!canInstall) {
    return null;
  }

  return (
    <Anchor component='button' type='button' size='sm' onClick={onClick}>
      {t('pages.admin.servers.tabs.general.page.form.eggInstallHint', {})}
    </Anchor>
  );
}
