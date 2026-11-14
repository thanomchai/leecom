import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import DOMPurify from "isomorphic-dompurify";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/svg+xml"
  | "image/webp";
export type ImageFormat = "jpg" | "png" | "svg" | "webp";

export class ImageUploadError extends Error {}

type ValidatedImage = {
  buffer: Buffer;
  mimeType: ImageMimeType;
  extension: ImageFormat;
};

const IMAGE_TYPES: Record<ImageMimeType, ImageFormat> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const IMAGE_TYPE_LABELS: Record<ImageMimeType, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/svg+xml": "SVG",
  "image/webp": "WebP",
};

export async function validateImageFile(
  value: FormDataEntryValue | null,
  allowedTypes: readonly ImageMimeType[],
  required: boolean,
): Promise<ValidatedImage | undefined> {
  if (!(value instanceof File)) {
    if (required) {
      throw new ImageUploadError("กรุณาเลือกไฟล์รูปภาพ");
    }
    return undefined;
  }
  if (value.size === 0 && value.name === "" && !required) {
    return undefined;
  }
  if (value.size === 0 || value.size > MAX_IMAGE_SIZE) {
    throw new ImageUploadError("ไฟล์ต้องมีขนาดมากกว่า 0 และไม่เกิน 5 MB");
  }
  const mimeType = value.type as ImageMimeType;
  if (!allowedTypes.includes(mimeType)) {
    throw new ImageUploadError(
      `รองรับไฟล์ ${allowedTypes
        .map((type) => IMAGE_TYPE_LABELS[type])
        .join(", ")} ตามที่กำหนดเท่านั้น`,
    );
  }

  const uploadedBuffer = Buffer.from(await value.arrayBuffer());
  let buffer: Buffer;
  if (mimeType === "image/svg+xml") {
    buffer = sanitizeSvg(uploadedBuffer);
  } else {
    const detectedMimeType = detectImageType(uploadedBuffer);
    if (
      !detectedMimeType ||
      detectedMimeType !== mimeType ||
      !allowedTypes.includes(detectedMimeType)
    ) {
      throw new ImageUploadError("ชนิดไฟล์ไม่ตรงกับข้อมูลภายในไฟล์ภาพ");
    }
    buffer = uploadedBuffer;
  }

  return {
    buffer,
    mimeType,
    extension: IMAGE_TYPES[mimeType],
  };
}

function sanitizeSvg(buffer: Buffer): Buffer {
  const source = buffer.toString("utf8");
  if (source.includes("\uFFFD")) {
    throw new ImageUploadError("ไฟล์ SVG ต้องเป็นข้อความ UTF-8 ที่ถูกต้อง");
  }

  const sanitized = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ["foreignObject", "script", "iframe", "object", "embed"],
  }).trim();
  if (!/^<svg(?:\s|>)/i.test(sanitized) || !/<\/svg>\s*$/i.test(sanitized)) {
    throw new ImageUploadError("ไฟล์ SVG ไม่ถูกต้องหรือไม่มีองค์ประกอบ SVG");
  }

  return Buffer.from(sanitized, "utf8");
}

function detectImageType(buffer: Buffer): ImageMimeType | undefined {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

export async function saveImageFile(
  image: ValidatedImage,
  directory: string,
): Promise<{ filename: string; path: string }> {
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${image.extension}`;
  const filePath = path.join(/*turbopackIgnore: true*/ directory, filename);
  await writeFile(filePath, image.buffer, { flag: "wx" });
  return { filename, path: filePath };
}

export async function removeSavedFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}
