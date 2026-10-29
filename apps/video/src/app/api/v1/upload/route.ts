import { nanoid } from "nanoid";

import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { handleApiError, apiSuccess } from "@/lib/api/response";
import {
  SIGNED_URL_DEFAULT_TTL,
  getStorage,
  isStorageConfigured,
} from "@/lib/storage";
import {
  fileToDataUrl,
  isSafetyApproved,
  moderateContent,
  safetyMessage,
} from "@/lib/content-safety";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);

    if (!isStorageConfigured()) {
      throw new ApiError("Storage not configured", 503);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("Missing file", 400);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new ApiError(
        `Invalid content type. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError("File too large", 400);
    }

    const locale = request.headers.get("accept-language") ?? "en";
    const safety = await moderateContent({
      text: "",
      images: [{ url: await fileToDataUrl(file), label: file.name }],
      context: "upload",
    });
    if (!isSafetyApproved(safety)) {
      throw new ApiError(safetyMessage(safety, locale), 422, {
        code: "CONTENT_BLOCKED",
        decision: safety.decision,
        categories: safety.categories,
      });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const key = `uploads/${user.id}/${nanoid()}.${ext}`;

    const storage = getStorage();
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.uploadFile({
      key,
      body: buffer,
      contentType: file.type,
    });

    return apiSuccess({
      key,
      signedUrl: storage.getSignedUrl(key, SIGNED_URL_DEFAULT_TTL),
      expiresIn: SIGNED_URL_DEFAULT_TTL,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
