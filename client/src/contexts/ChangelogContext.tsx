import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChangelogContextType {
  isOpen: boolean;
  openChangelog: () => void;
  closeChangelog: () => void;
}

const ChangelogContext = createContext<ChangelogContextType | undefined>(undefined);

export function ChangelogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ChangelogContext.Provider
      value={{
        isOpen,
        openChangelog: () => setIsOpen(true),
        closeChangelog: () => setIsOpen(false),
      }}
    >
      {children}
    </ChangelogContext.Provider>
  );
}

export function useChangelogContext() {
  const context = useContext(ChangelogContext);
  if (!context) {
    throw new Error('useChangelogContext must be used within ChangelogProvider');
  }
  return context;
}

































