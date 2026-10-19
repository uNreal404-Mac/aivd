type GenerateImageInputData = {
  imageUrl?: string;
  imageUrls?: string[];
  imageKey?: string;
  imageKeys?: string[];
};

function hasOwn(
  data: GenerateImageInputData,
  key: keyof GenerateImageInputData,
): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function nonEmpty(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

export function resolveGenerateImageInputs(
  data: GenerateImageInputData,
): {
  imageUrl?: string;
  imageUrls?: string[];
  requestedImage: boolean;
} {
  const imageUrl = nonEmpty(data.imageUrl) ?? nonEmpty(data.imageKey);
  const mergedImageUrls = [
    ...(data.imageUrls ?? []),
    ...(data.imageKeys ?? []),
  ];

  return {
    imageUrl,
    imageUrls: mergedImageUrls.length > 0 ? mergedImageUrls : undefined,
    requestedImage:
      hasOwn(data, "imageUrl") ||
      hasOwn(data, "imageUrls") ||
      hasOwn(data, "imageKey") ||
      hasOwn(data, "imageKeys"),
  };
}
