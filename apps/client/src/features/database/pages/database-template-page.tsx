import { Container } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config";
import { TemplatePeekBody } from "@/features/database/components/template-peek/template-peek-body";

// Full-page host for the database row-template editor (#102). Reached from the
// peek's "open as page" control; `:templateId` is "new" when creating.
export default function DatabaseTemplatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { databaseId, templateId } = useParams<{
    databaseId: string;
    templateId: string;
  }>();

  if (!databaseId) return null;

  const resolvedTemplateId =
    !templateId || templateId === "new" ? null : templateId;

  return (
    <>
      <Helmet>
        <title>
          {t("Edit template")} - {getAppName()}
        </title>
      </Helmet>
      <Container size={760} py="lg">
        <TemplatePeekBody
          databaseId={databaseId}
          templateId={resolvedTemplateId}
          onClose={() => navigate(-1)}
        />
      </Container>
    </>
  );
}
