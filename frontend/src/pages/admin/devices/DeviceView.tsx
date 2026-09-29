import { faCog, faComputer, faEgg, faServer } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getDevice from '@/api/admin/devices/getDevice.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DeviceCreateOrUpdate from './DeviceCreateOrUpdate.tsx';
import AdminDeviceEggs from './eggs/AdminDeviceEggs.tsx';
import AdminDeviceNodes from './nodes/AdminDeviceNodes.tsx';
import AdminDeviceServers from './servers/AdminDeviceServers.tsx';

export default function DeviceView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.devices.detail(params.id!),
    queryFn: () => getDevice(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(device) => (
        <AdminContentContainer
          title={device.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.devices.container}
        >
          <SubNavigation
            baseUrl={`/admin/devices/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.devices.view.subNavigation}
            registryProps={{ device }}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <DeviceCreateOrUpdate contextDevice={device} />,
              },
              {
                name: t('pages.admin.devices.tabs.eggs.title', {}),
                icon: faEgg,
                path: `/eggs`,
                element: <AdminDeviceEggs device={device} />,
                permission: 'eggs.read',
              },
              {
                name: t('pages.admin.devices.tabs.nodes.title', {}),
                icon: faServer,
                path: `/nodes`,
                element: <AdminDeviceNodes device={device} />,
                permission: 'nodes.read',
              },
              {
                name: t('pages.admin.devices.tabs.servers.title', {}),
                icon: faComputer,
                path: `/servers`,
                element: <AdminDeviceServers device={device} />,
                permission: 'servers.read',
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
