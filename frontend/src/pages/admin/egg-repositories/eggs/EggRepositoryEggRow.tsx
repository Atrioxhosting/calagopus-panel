import { forwardRef, memo } from 'react';
import { z } from 'zod';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminEggRepositoryEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';

interface EggRepositoryEggRowProps {
  egg: z.infer<typeof adminEggRepositoryEggSchema>;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
  onOpen: () => void;
}

const EggRepositoryEggRow = memo(
  forwardRef<HTMLTableRowElement, EggRepositoryEggRowProps>(function EggRepositoryEggRow(
    { egg, isSelected, onSelectionChange, onOpen },
    ref,
  ) {
    return (
      <TableRow
        bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
        ref={ref}
        className='cursor-pointer'
        onClick={onOpen}
      >
        <TableSelectionCell id={egg.uuid} checked={isSelected} onChange={onSelectionChange} />

        <TableData>
          <Code>{egg.path}</Code>
        </TableData>

        <TableData>{egg.exportedEgg.name}</TableData>

        <TableData>{egg.exportedEgg.author}</TableData>

        <TableData>{egg.exportedEgg.description}</TableData>

        <TableData>
          <FormattedTimestamp timestamp={egg.updated} />
        </TableData>
      </TableRow>
    );
  }),
);

export default EggRepositoryEggRow;
