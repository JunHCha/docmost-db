import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/ee/base/services/base-service";
import {
  IBaseTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  DeleteTemplateInput,
} from "@/ee/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";

export function baseTemplatesQueryKey(pageId: string) {
  return ["base-templates", pageId] as const;
}

export function useBaseTemplatesQuery(
  pageId: string | undefined,
): UseQueryResult<IBaseTemplate[], Error> {
  return useQuery({
    queryKey: baseTemplatesQueryKey(pageId ?? ""),
    queryFn: () => listTemplates(pageId!),
    enabled: !!pageId,
    staleTime: 5 * 60 * 1000,
  });
}

function patchTemplateCache(
  pageId: string,
  update: (templates: IBaseTemplate[]) => IBaseTemplate[],
) {
  queryClient.setQueryData<IBaseTemplate[]>(
    baseTemplatesQueryKey(pageId),
    (old) => update(old ?? []),
  );
}

export function useCreateTemplateMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseTemplate, Error, CreateTemplateInput>({
    mutationFn: (data) => createTemplate(data),
    onSuccess: (created) => {
      patchTemplateCache(created.pageId, (templates) => [
        ...templates,
        created,
      ]);
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create template")),
        color: "red",
      });
    },
  });
}

export function useUpdateTemplateMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseTemplate, Error, UpdateTemplateInput>({
    mutationFn: (data) => updateTemplate(data),
    onSuccess: (updated) => {
      patchTemplateCache(updated.pageId, (templates) =>
        templates.map((tpl) => (tpl.id === updated.id ? updated : tpl)),
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update template")),
        color: "red",
      });
    },
  });
}

export function useDeleteTemplateMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteTemplateInput>({
    mutationFn: (data) => deleteTemplate(data),
    onSuccess: (_, variables) => {
      patchTemplateCache(variables.pageId, (templates) =>
        templates.filter((tpl) => tpl.id !== variables.templateId),
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete template")),
        color: "red",
      });
    },
  });
}
