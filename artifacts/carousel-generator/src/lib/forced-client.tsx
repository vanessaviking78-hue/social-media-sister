import { createContext, useContext } from "react";

// When a tool is shown as a tab inside a client's own page, this tells it which client to open on and,
// for Universal, which treatments that client offers. Outside a client page there is no value, so every tool behaves as before.
export type ForcedClient = { pattern: RegExp; treatmentIds?: string[] };
export const ForcedClientContext = createContext<ForcedClient | null>(null);
export const useForcedClient = () => useContext(ForcedClientContext);
