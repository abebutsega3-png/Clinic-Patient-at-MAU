import { useContext } from 'react';
import { ShiftManagementContext } from './ShiftManagementStore.js';

export function useShiftManagement() {
  const context = useContext(ShiftManagementContext);
  if (!context) throw new Error('useShiftManagement must be used within ShiftManagementProvider.');
  return context;
}
