import { createContext, useContext } from "react";

// Tells the filter UI (deep under a DatabaseView) which page hosts the embed,
// so a relation filter can offer a "This page" reference resolved to that page
// at render time (issue: live self-reference). Provided by DatabaseView for an
// embed; null on the database's own page, where "this page" is meaningless.
export interface EmbedHostContextValue {
  hostPageId?: string;
}

const Ctx = createContext<EmbedHostContextValue | null>(null);

export const EmbedHostProvider = Ctx.Provider;

export const useEmbedHost = () => useContext(Ctx);
