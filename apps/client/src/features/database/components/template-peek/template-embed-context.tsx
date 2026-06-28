import { createContext, useContext } from "react";
import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

// One stored embed view as persisted on a template's embedViews JSON, keyed by
// embedId: { [embedId]: StoredEmbedView[] }. config mirrors IDatabaseViewConfig
// but is loosely typed here because it travels through opaque JSON (issue #115).
export interface StoredEmbedView {
  name: string;
  type: string;
  config: Record<string, any>;
  isDefault?: boolean;
}

// Provided by the template row editor so an embedded DatabaseView mounted inside
// the template body can (a) edit/save its view into the template record rather
// than the page-scoped views table, and (b) offer the template's relation
// properties as filter $ref targets. Absent (null) for a normal page/DB embed,
// which keeps its existing server-backed behaviour.
export interface TemplateEmbedContextValue {
  templateProperties: IDatabaseProperty[];
  getEmbedViews: (embedId: string) => StoredEmbedView[] | undefined;
  setEmbedViews: (embedId: string, views: StoredEmbedView[]) => void;
}

const Ctx = createContext<TemplateEmbedContextValue | null>(null);

export const TemplateEmbedProvider = Ctx.Provider;

export const useTemplateEmbedContext = () => useContext(Ctx);
