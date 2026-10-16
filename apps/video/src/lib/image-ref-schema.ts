import { z } from "zod";
import { IMAGE_REF_PATTERN } from "@/lib/storage";

export const IMAGE_REF_MAX_LENGTH = 2048;

export const imageRefSchema = z
  .string()
  .min(1)
  // signed URLs carry long X-Amz-* query strings
  .max(IMAGE_REF_MAX_LENGTH)
  .refine(
    (value) => /^https?:\/\//.test(value) || IMAGE_REF_PATTERN.test(value),
    "Invalid image reference",
  );
