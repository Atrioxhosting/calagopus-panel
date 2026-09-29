import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';

export default function DeviceRow({ device }: { device: z.infer<typeof adminDeviceSchema> }) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/devices/${device.uuid}`}>
          <Code>{device.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{device.name}</TableData>
      <TableData>
        <Code>{device.source}</Code>
      </TableData>
      <TableData>
        <Code>{device.target}</Code>
      </TableData>
      <TableData>
        <FormattedTimestamp timestamp={device.created} />
      </TableData>
    </TableRow>
  );
}
