const MAX_EDGE = 1600;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const QUALITY_STEPS = [0.86, 0.74, 0.62, 0.5, 0.42];

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

export interface ImageProcessingDependencies {
  decode(file: File): Promise<DecodedImage>;
  encode(
    source: CanvasImageSource,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob>;
  createObjectUrl(blob: Blob): string;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: "image/webp";
  previewUrl: string;
}

export interface ImageRotationDependencies {
  decode(blob: Blob): Promise<DecodedImage>;
  encodeRotated(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    degrees: number,
    quality: number,
  ): Promise<Blob>;
  createObjectUrl(blob: Blob): string;
}

const browserDependencies: ImageProcessingDependencies = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  },
  async encode(source, width, height, quality) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("当前浏览器无法处理图片画布");
    context.drawImage(source, 0, 0, width, height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("图片重新编码失败"))),
        "image/webp",
        quality,
      );
    });
  },
  createObjectUrl: (blob) => URL.createObjectURL(blob),
};

const browserRotationDependencies: ImageRotationDependencies = {
  async decode(blob) {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  },
  async encodeRotated(source, sourceWidth, sourceHeight, degrees, quality) {
    const swapsEdges = Math.abs(degrees) % 180 === 90;
    const canvas = document.createElement("canvas");
    canvas.width = swapsEdges ? sourceHeight : sourceWidth;
    canvas.height = swapsEdges ? sourceWidth : sourceHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("当前浏览器无法旋转图片");
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((degrees * Math.PI) / 180);
    context.drawImage(source, -sourceWidth / 2, -sourceHeight / 2);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("旋转后的图片编码失败"))),
        "image/webp",
        quality,
      );
    });
  },
  createObjectUrl: (blob) => URL.createObjectURL(blob),
};

export async function processImage(
  file: File,
  dependencies: ImageProcessingDependencies = browserDependencies,
): Promise<ProcessedImage> {
  if (!SUPPORTED_MIME.has(file.type)) {
    throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
  }

  const decoded = await dependencies.decode(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    for (const quality of QUALITY_STEPS) {
      const blob = await dependencies.encode(decoded.source, width, height, quality);
      if (blob.size <= MAX_OUTPUT_BYTES) {
        return {
          blob,
          width,
          height,
          mimeType: "image/webp",
          previewUrl: dependencies.createObjectUrl(blob),
        };
      }
    }

    throw new Error("图片压缩后仍超过 2MB，请裁切后重试");
  } finally {
    decoded.close?.();
  }
}

export async function rotateProcessedImage(
  image: ProcessedImage,
  degrees: number,
  dependencies: ImageRotationDependencies = browserRotationDependencies,
): Promise<ProcessedImage> {
  const normalized = ((degrees % 360) + 360) % 360;
  if (![90, 180, 270].includes(normalized)) return image;

  const decoded = await dependencies.decode(image.blob);
  try {
    const swapsEdges = normalized % 180 === 90;
    for (const quality of QUALITY_STEPS) {
      const blob = await dependencies.encodeRotated(
        decoded.source,
        decoded.width,
        decoded.height,
        normalized,
        quality,
      );
      if (blob.size <= MAX_OUTPUT_BYTES) {
        return {
          blob,
          width: swapsEdges ? image.height : image.width,
          height: swapsEdges ? image.width : image.height,
          mimeType: "image/webp",
          previewUrl: dependencies.createObjectUrl(blob),
        };
      }
    }
    throw new Error("旋转后的图片超过 2MB，请裁切后重试");
  } finally {
    decoded.close?.();
  }
}
