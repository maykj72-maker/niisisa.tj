import { API_BASE } from "./api-config";

export type UploadedMedia = {
  src: string;
  type: "image" | "video";
};

const MEDIA_TYPES: Record<string, { type: UploadedMedia["type"]; mime: string }> = {
  ".jpg": { type: "image", mime: "image/jpeg" },
  ".jpeg": { type: "image", mime: "image/jpeg" },
  ".png": { type: "image", mime: "image/png" },
  ".webp": { type: "image", mime: "image/webp" },
  ".gif": { type: "image", mime: "image/gif" },
  ".mp4": { type: "video", mime: "video/mp4" },
  ".webm": { type: "video", mime: "video/webm" },
};

export function isAllowedMediaUrl(value: string): boolean {
  const source = value.trim();
  if (source.startsWith("/") && !source.startsWith("//") && !source.includes("\\")) return true;
  try {
    const url = new URL(source);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function uploadMediaFile(file: File): Promise<UploadedMedia> {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const mediaInfo = MEDIA_TYPES[extension];
  if (!mediaInfo) throw new Error("Истифодаи JPG, PNG, WebP, GIF, MP4 ё WebM иҷозат аст.");

  const maxBytes = mediaInfo.type === "video" ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(mediaInfo.type === "video" ? "Ҳаҷми видео бояд аз 100 МБ зиёд набошад." : "Ҳаҷми акс бояд аз 5 МБ зиёд набошад.");
  }
  if (file.type && file.type !== mediaInfo.mime && file.type !== "application/octet-stream") {
    throw new Error("Навъи файл ба формати интихобшуда мувофиқат намекунад.");
  }

  const response = await fetch(`${API_BASE}/media`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": mediaInfo.mime,
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      message = (JSON.parse(body) as { detail?: string }).detail || body;
    } catch {
      // Keep the original API response when it is not JSON.
    }
    throw new Error(message || `Бор кардани файл муваффақ нашуд (${response.status}).`);
  }

  const result = (await response.json()) as { url?: string; type?: UploadedMedia["type"] };
  if (!result.url || result.type !== mediaInfo.type) {
    throw new Error("Ҷавоби сервер барои файли боршуда нодуруст аст.");
  }
  return { src: result.url, type: result.type };
}
