import { createContext, useContext } from 'react';

/** State tampilan mockup, dikendalikan dari toolbar preview (?state=...). */
export type MockState = 'ready' | 'loading' | 'empty' | 'error';

export const MockStateContext = createContext<MockState>('ready');
export const useMockState = () => useContext(MockStateContext);

/** Navigasi antar mockup (hash router sederhana). */
export function go(pageId: string) {
  const inFrame = window.location.hash.includes('frame=1');
  window.location.hash = `#/p/${pageId}${inFrame ? '?frame=1' : ''}`;
}
