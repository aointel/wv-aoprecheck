import React, { createContext, useContext } from 'react';

/** When Connect embeds InboundCallHeaderPanel, Taalk must mount inside the panel — not a hidden duplicate #mount-vdp-selector. */
export const TaalkVdpMountRefContext = createContext<React.MutableRefObject<HTMLDivElement | null> | null>(null);

export function useTaalkVdpMountRef(): React.MutableRefObject<HTMLDivElement | null> | null {
  return useContext(TaalkVdpMountRefContext);
}
