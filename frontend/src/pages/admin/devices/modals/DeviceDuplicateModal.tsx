import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import duplicateDevice from '@/api/admin/devices/duplicateDevice.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import ResourceDuplicateModal from '@/elements/modals/ResourceDuplicateModal.tsx';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DeviceDuplicateModal({
  device,
  ...props
}: ModalProps & { device: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    setSource(device.source);
    setTarget(device.target);
  }, [device, props.opened]);

  return (
    <ResourceDuplicateModal
      {...props}
      resourceName={t('pages.admin.devices.resourceName', {})}
      sourceName={device.name}
      duplicate={(name) => duplicateDevice(device.uuid, name, source, target)}
      redirectTo={(duplicated) => `/admin/devices/${duplicated.uuid}`}
      disabled={source.length < 1 || target.length < 1}
    >
      <TextInput
        withAsterisk
        label={t('common.form.source', {})}
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <TextInput
        withAsterisk
        label={t('common.form.target', {})}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
    </ResourceDuplicateModal>
  );
}
