// Full-page route for a database row template (#102). templateId null => the
// "new template" route.
export function buildTemplatePageUrl(
  databaseId: string,
  templateId: string | null,
): string {
  return `/databases/${databaseId}/templates/${templateId ?? "new"}`;
}
