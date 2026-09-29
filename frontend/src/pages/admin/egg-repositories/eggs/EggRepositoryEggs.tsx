import { Ref, useState } from 'react';
import { z } from 'zod';
import getEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getEggRepositoryEggs.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { eggRepositoryEggTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTableSelection } from '@/plugins/selection/useTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryEggDrawer from './drawers/EggRepositoryEggDrawer.tsx';
import EggActionBar from './EggActionBar.tsx';
import EggRepositoryEggRow from './EggRepositoryEggRow.tsx';

export default function EggRepositoryEggs({
  contextEggRepository,
}: {
  contextEggRepository: z.infer<typeof adminEggRepositorySchema>;
}) {
  const { t } = useTranslations();
  const [drawerEgg, setDrawerEgg] = useState<z.infer<typeof adminEggRepositoryEggSchema> | null>(null);

  const {
    data: eggRepositoryEggs,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggRepositories.eggs(contextEggRepository.uuid),
    fetcher: (page, search) => getEggRepositoryEggs(contextEggRepository.uuid, page, search),
  });

  const { selected, add, remove, clear, selectAll, allSelected, selectionAreaProps } = useTableSelection({
    items: eggRepositoryEggs?.data,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.eggRepositories.tabs.eggs.page.title', {})}
      search={search}
      setSearch={setSearch}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.eggRepositories.view.eggs.subContainer}
      registryProps={{ eggRepository: contextEggRepository }}
    >
      <EggActionBar eggRepository={contextEggRepository} selectedEggs={selected} onInstalled={clear} />

      <EggRepositoryEggDrawer
        eggRepository={contextEggRepository}
        egg={drawerEgg}
        opened={drawerEgg !== null}
        onClose={() => setDrawerEgg(null)}
      />

      <SelectionArea {...selectionAreaProps} disabled={drawerEgg !== null}>
        <Table
          columns={[
            tableSelectionHeader({
              checked: allSelected,
              indeterminate: selected.size > 0 && !allSelected,
              onChange: (checked) => (checked ? selectAll() : clear()),
            }),
            ...eggRepositoryEggTableColumns().slice(1),
          ]}
          loading={loading}
          error={error}
          pagination={eggRepositoryEggs}
          onPageSelect={setPage}
        >
          {eggRepositoryEggs?.data.map((eggRepositoryEgg) => (
            <SelectionArea.Selectable key={eggRepositoryEgg.uuid} item={eggRepositoryEgg}>
              {(innerRef: Ref<HTMLElement>) => (
                <EggRepositoryEggRow
                  key={eggRepositoryEgg.uuid}
                  egg={eggRepositoryEgg}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selected.has(eggRepositoryEgg.uuid)}
                  onSelectionChange={(isSelected) => (isSelected ? add(eggRepositoryEgg) : remove(eggRepositoryEgg))}
                  onOpen={() => setDrawerEgg(eggRepositoryEgg)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminSubContentContainer>
  );
}
