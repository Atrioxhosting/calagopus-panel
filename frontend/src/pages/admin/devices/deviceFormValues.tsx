import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { adminDeviceSchema, adminDeviceUpdateSchema } from '@/lib/schemas/admin/devices.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type DeviceFormValues = z.infer<typeof adminDeviceUpdateSchema>;

export const deviceEmptyFormValues: DeviceFormValues = {
  name: '',
  description: null,
  source: '',
  target: '',
  permissions: 'rwm',
  userAttachable: false,
};

export const deviceToFormValues = (device: z.infer<typeof adminDeviceSchema>): DeviceFormValues => ({
  name: device.name,
  description: device.description,
  source: device.source,
  target: device.target,
  permissions: device.permissions,
  userAttachable: device.userAttachable,
});

export function useDeviceFormFields(): FieldDef<DeviceFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    { type: 'text', name: 'source', label: t('common.form.source', {}), required: true },
    { type: 'text', name: 'target', label: t('common.form.target', {}), required: true },
    {
      type: 'text',
      name: 'permissions',
      label: t('pages.admin.devices.tabs.general.page.form.permissions', {}),
      description: t('pages.admin.devices.tabs.general.page.form.permissionsDescription', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'userAttachable',
      label: t('pages.admin.devices.tabs.general.page.form.userAttachable', {}),
    },
  ];
}
