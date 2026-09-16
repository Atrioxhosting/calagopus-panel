import { faPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import getPermissions from '@/api/getPermissions.ts';
import getSubusers from '@/api/server/subusers/getSubusers.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import SubuserCreateModal from './modals/SubuserCreateModal.tsx';
import SubuserRow from './SubuserRow.tsx';

export default function ServerSubusers() {
  const { t } = useTranslations();
  const { server } = useServerStore();
  const { settings, setAvailablePermissions } = useGlobalStore();

  const canCreate = useServerCan('subusers.create');

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  useEffect(() => {
    getPermissions().then((res) => {
      setAvailablePermissions(res);
    });
  }, []);

  const {
    data: subusers,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).subusers.all(),
    fetcher: (page, search) => getSubusers(server.uuid, page, search),
  });

  const atLimit = (subusers?.total ?? 0) >= settings.server.maxSubuserCount;
  const isEmpty = !loading && !error && !debouncedSearch && subusers?.total === 0;

  return (
    <ServerContentContainer
      title={t('pages.server.subusers.title', {})}
      subtitle={t('pages.server.subusers.subtitle', {
        current: subusers?.total ?? 0,
        max: settings.server.maxSubuserCount,
      })}
      search={search}
      setSearch={isEmpty ? undefined : setSearch}
      contentRight={
        isEmpty ? undefined : (
          <ServerCan action='subusers.create'>
            <ConditionalTooltip
              enabled={atLimit}
              label={t('pages.server.subusers.tooltip.limitReached', { max: settings.server.maxSubuserCount })}
            >
              <Button
                onClick={() => setOpenModal('create')}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                disabled={atLimit}
              >
                {t('common.button.create', {})}
              </Button>
            </ConditionalTooltip>
          </ServerCan>
        )
      }
      registry={window.extensionContext.extensionRegistry.pages.server.subusers.container}
    >
      <SubuserCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <Table
        columns={[
          '',
          t('common.table.columns.username', {}),
          t('pages.server.subusers.table.columns.twoFactorEnabled', {}),
          t('pages.server.subusers.table.columns.permissions', {}),
          t('pages.server.subusers.table.columns.ignoredFiles', {}),
          '',
        ]}
        loading={loading}
        pagination={subusers}
        onPageSelect={setPage}
        error={error}
        empty={
          debouncedSearch ? undefined : (
            <EmptyState
              flush
              icon={faUsers}
              title={t('pages.server.subusers.empty.title', {})}
              description={
                canCreate
                  ? t('pages.server.subusers.empty.description', {})
                  : t('pages.server.subusers.empty.descriptionReadOnly', {})
              }
            >
              <ServerCan action='subusers.create'>
                <ConditionalTooltip
                  enabled={atLimit}
                  label={t('pages.server.subusers.tooltip.limitReached', { max: settings.server.maxSubuserCount })}
                >
                  <Button
                    onClick={() => setOpenModal('create')}
                    color='blue'
                    leftSection={<FontAwesomeIcon icon={faPlus} />}
                    disabled={atLimit}
                  >
                    {t('pages.server.subusers.button.createFirstSubuser', {})}
                  </Button>
                </ConditionalTooltip>
              </ServerCan>
            </EmptyState>
          )
        }
      >
        {subusers?.data.map((su) => (
          <SubuserRow subuser={su} key={su.user.uuid} />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
