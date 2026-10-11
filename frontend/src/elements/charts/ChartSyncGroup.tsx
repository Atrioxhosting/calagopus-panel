import { ReactNode, useMemo, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { ChartSyncContext } from '@/providers/contexts/chartSyncContext.ts';

function ChartSyncGroup({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<number | null>(null);
  const value = useMemo(() => ({ at, setAt }), [at]);

  return <ChartSyncContext.Provider value={value}>{children}</ChartSyncContext.Provider>;
}

export default makeComponentHookable(ChartSyncGroup);
