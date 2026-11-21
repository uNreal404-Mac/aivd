"use client";

import { useTranslations } from "next-intl";

import { catalogDetailKey, type CatalogModel } from "@/lib/kie-model-catalog";

/**
 * A catalogue model's one-line subtitle in the page language, from
 * ModelPicker.details in the messages; falls back to the English `detail`.
 * Shared by the model picker, the section pages' model grid and the video studio.
 */
export function useCatalogDetail(): (item: Pick<CatalogModel, "id" | "detail">) => string {
  const t = useTranslations("ModelPicker");
  return (item) => {
    const key = `details.${catalogDetailKey(item.id)}`;
    return t.has(key) ? t(key) : item.detail;
  };
}
