import { createContext, useContext } from 'react';

export interface ChartSyncContextType {
  at: number | null;
  setAt: (at: number | null) => void;
}

export const ChartSyncContext = createContext<ChartSyncContextType | undefined>(undefined);

export const useChartSync = () => useContext(ChartSyncContext);
