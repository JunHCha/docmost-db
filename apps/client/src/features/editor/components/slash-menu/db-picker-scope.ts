// The "Database view (linked)" slash item hands off to a host-level picker via
// the `openDatabasePickerFromEditor` CustomEvent. Several editors can be mounted
// at once (a page editor plus a database template editor), so the event carries
// a scope marker and each host decides whether the event is its own (#113).
export interface DbPickerEventDetail {
  pageId?: string;
  templateEditorId?: string;
}

// A page editor opens for its own pageId, or for a legacy event that carries no
// marker (backward-compat). A template-scoped event is never its own.
export function shouldPageEditorOpenPicker(
  detail: DbPickerEventDetail | undefined,
  pageId: string,
): boolean {
  if (detail?.templateEditorId) return false;
  if (detail?.pageId && detail.pageId !== pageId) return false;
  return true;
}

// A template editor opens only for an event marked with its own templateEditorId
// — never for page-scoped or markerless events.
export function shouldTemplateEditorOpenPicker(
  detail: DbPickerEventDetail | undefined,
  templateEditorId: string,
): boolean {
  return detail?.templateEditorId === templateEditorId;
}
