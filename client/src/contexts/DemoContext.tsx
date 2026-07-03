import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DemoContextType {
  isDemoMode: boolean;
  demoProduct: 'aointel' | 'recruit' | 'callconnector' | 'precheck' | null;
  enterDemoMode: (product: 'aointel' | 'recruit' | 'callconnector' | 'precheck') => void;
  exitDemoMode: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoProduct, setDemoProduct] = useState<'aointel' | 'recruit' | 'callconnector' | 'precheck' | null>(null);

  // Load demo state from localStorage on mount
  useEffect(() => {
    const savedDemoMode = localStorage.getItem('demo_mode');
    const savedDemoProduct = localStorage.getItem('demo_product');
    if (savedDemoMode === 'true' && savedDemoProduct) {
      setIsDemoMode(true);
      setDemoProduct(savedDemoProduct as any);
    }
  }, []);

  const enterDemoMode = (product: 'aointel' | 'recruit' | 'callconnector' | 'precheck') => {
    setIsDemoMode(true);
    setDemoProduct(product);
    localStorage.setItem('demo_mode', 'true');
    localStorage.setItem('demo_product', product);
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    setDemoProduct(null);
    localStorage.removeItem('demo_mode');
    localStorage.removeItem('demo_product');
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, demoProduct, enterDemoMode, exitDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}

