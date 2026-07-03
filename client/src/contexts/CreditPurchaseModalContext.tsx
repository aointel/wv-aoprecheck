'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CreditPurchaseModal } from '@/components/stripe/CreditPurchaseModal';

interface CreditPurchaseModalContextType {
  openCreditPurchaseModal: () => void;
  closeCreditPurchaseModal: () => void;
}

const CreditPurchaseModalContext = createContext<CreditPurchaseModalContextType | undefined>(undefined);

export function CreditPurchaseModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const openCreditPurchaseModal = useCallback(() => setIsOpen(true), []);
  const closeCreditPurchaseModal = useCallback(() => setIsOpen(false), []);

  const handleCreditsAdded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/user/credits'] });
    setIsOpen(false);
  }, [queryClient]);

  return (
    <CreditPurchaseModalContext.Provider value={{ openCreditPurchaseModal, closeCreditPurchaseModal }}>
      {children}
      <CreditPurchaseModal
        isOpen={isOpen}
        onClose={closeCreditPurchaseModal}
        onCreditsAdded={handleCreditsAdded}
      />
    </CreditPurchaseModalContext.Provider>
  );
}

export function useCreditPurchaseModal() {
  const context = useContext(CreditPurchaseModalContext);
  if (!context) {
    throw new Error('useCreditPurchaseModal must be used within CreditPurchaseModalProvider');
  }
  return context;
}

/** Optional hook that returns open fn or null if provider not mounted (for use in components that may render outside provider). */
export function useCreditPurchaseModalOptional(): CreditPurchaseModalContextType | null {
  return useContext(CreditPurchaseModalContext) ?? null;
}
