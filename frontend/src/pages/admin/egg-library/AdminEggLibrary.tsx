import { faDownload, faEgg } from '@fortawesome/free-solid-svg-icons';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggLibraryAvailable from './EggLibraryAvailable.tsx';
import EggLibraryInstalled from './EggLibraryInstalled.tsx';

export default function AdminEggLibrary() {
  const { t } = useTranslations();

  return (
    <AdminContentContainer title={t('pages.admin.eggLibrary.title', {})}>
      <SubNavigation
        baseUrl='/admin/egg-library'
        items={[
          {
            name: t('pages.admin.eggLibrary.tabs.installed.title', {}),
            icon: faEgg,
            path: '/',
            element: <EggLibraryInstalled />,
            permission: 'eggs.read',
          },
          {
            name: t('pages.admin.eggLibrary.tabs.available.title', {}),
            icon: faDownload,
            path: '/available',
            element: <EggLibraryAvailable />,
            permission: 'egg-repositories.read',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
