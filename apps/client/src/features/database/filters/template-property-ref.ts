// A relation filter inside a template's embed view may carry a *reference* value
// of the form { templatePropertyRef: <templatePropertyId> } instead of a literal
// page id. The row creation flow snapshots these against the new row's actual
// relation values (server side, issue #115). This guard mirrors the server util
// (template-embed-view.util.ts) so client and server agree on the tagged shape.
export interface TemplatePropertyRef {
  templatePropertyRef: string;
}

export function isTemplatePropertyRef(
  value: unknown,
): value is TemplatePropertyRef {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { templatePropertyRef?: unknown }).templatePropertyRef ===
      "string"
  );
}
