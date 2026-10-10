import { loadLogoImage, trimImage } from "@/lib/logo-trim";

/**
 * Prepares images on the admin page before they are uploaded (browser only):
 * logos are trimmed and shrunk to 256px like the site shows them, banners
 * are shrunk to at most BANNER_WIDTH px. Both become WebP (PNG/JPEG in
 * browsers that cannot make WebP).
 */

const BANNER_WIDTH = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file could not be read as an image."));
    image.src = src;
  });
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, fallbackType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (webp) => {
        // Browsers without WebP support hand back a PNG instead.
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob(
          (other) => (other ? resolve(other) : reject(new Error("The image could not be converted."))),
          fallbackType,
          quality,
        );
      },
      "image/webp",
      quality,
    );
  });
}

function logoBlob(image: HTMLImageElement): Promise<Blob> {
  const trimmed = trimImage(image);
  if (!trimmed) throw new Error("The logo looks empty.");
  return canvasToBlob(trimmed, "image/png", 0.9);
}

/** A logo file chosen on the admin page, trimmed and shrunk. */
export async function logoFromFile(file: File): Promise<Blob> {
  return logoBlob(await fileToImage(file));
}

/**
 * A team's current logo URL (any site), trimmed and shrunk. Must already be
 * saved as the team's logo_url: other sites' images go through
 * app/api/logo/route.ts, which only fetches saved logo URLs.
 */
export async function logoFromSavedUrl(url: string): Promise<Blob> {
  return logoBlob(await loadLogoImage(url));
}

/** Size of the uploaded tab icon (browsers show 16-32px; this stays sharp). */
const FAVICON_SIZE = 128;

/**
 * A tab icon chosen on the admin page: the whole image fitted into a
 * FAVICON_SIZE square with see-through edges, as PNG (browsers handle PNG
 * icons everywhere).
 */
export async function faviconFromFile(file: File): Promise<Blob> {
  const image = await fileToImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be converted.");
  const scale = Math.min(FAVICON_SIZE / image.naturalWidth, FAVICON_SIZE / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (FAVICON_SIZE - width) / 2, (FAVICON_SIZE - height) / 2, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image could not be converted."))), "image/png"),
  );
}

/** A banner file chosen on the admin page, shrunk to BANNER_WIDTH px wide. */
export async function bannerFromFile(file: File): Promise<Blob> {
  const image = await fileToImage(file);
  const scale = Math.min(1, BANNER_WIDTH / image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be converted.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, "image/jpeg", 0.85);
}
