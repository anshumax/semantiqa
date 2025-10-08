import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

export type PanelKind = 'explorer' | 'inspector' | 'results';

type AppState = {
  selectedSourceId: string | null;
  selectSource: (id: string | null) => void;
  activePanel: PanelKind;
  setActivePanel: (panel: PanelKind) => void;
};

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelKind>('explorer');

  const value = useMemo<AppState>(
    () => ({
      selectedSourceId,
      selectSource: setSelectedSourceId,
      activePanel,
      setActivePanel,
    }),
    [selectedSourceId, activePanel],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }

  return context;
}


