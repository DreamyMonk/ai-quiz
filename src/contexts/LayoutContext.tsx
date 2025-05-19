
"use client";

import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from 'react';

interface LayoutContextType {
  isSidebarVisible: boolean;
  setIsSidebarVisible: Dispatch<SetStateAction<boolean>>;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Default to true

  // Log when the provider's state changes
  React.useEffect(() => {
    console.log("LayoutProvider: isSidebarVisible state updated to:", isSidebarVisible);
  }, [isSidebarVisible]);

  const value = { isSidebarVisible, setIsSidebarVisible };
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
