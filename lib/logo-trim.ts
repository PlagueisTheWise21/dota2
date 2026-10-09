/**
 * Trims empty margins from team logos in the browser, so each logo fills
 * its box on the tier list cards and in the copied image.
 *
 * The logo is loaded straight from this project's Supabase Storage, or else
 * through app/api/logo/route.ts (browsers only allow reading the pixels of
 * images whose site permits it), cropped to the visible logo and
 * shrunk to at most OUTPUT_SIZE px. Successful results are remembered per
 * URL for the rest of the visit; failures are retried next time. Browser-only.
 */

/** Largest side of a trimmed logo, in px (logos draw ~60px tall; 2x for sharp screens). */
const OUTPUT_SIZE = 256;
/** Logos are scanned at this size to find their edges (fast, precise enough). */
const SCAN_SIZE = 200;
/** Alpha below this counts as transparent. */
const ALPHA_THRESHOLD = 16;
/** Colour distance from the corner colour that still counts as background. */
const COLOR_THRESHOLD = 30;
/** Leave this fraction of the logo's size as breathing room on each side. */
const KEEP_MARGIN = 0.02;

const pending = new Map<string, Promise<string | null>>();
const finished = new Map<string, string | null>();

/** The trimmed logo as a data URL, or null if it cannot be loaded or read. */
export function getTrimmedLogo(logoUrl: string): Promise<string | null> {
  let result = pending.get(logoUrl);
  if (!result) {
    result = trimLogo(logoUrl)
      .catch(() => null)
      .then((trimmed) => {
        if (trimmed) {
          finished.set(logoUrl, trimmed);
        } else {
          // Often a slow or busy logo host: let the next request try again
          // instead of remembering the failure for the whole visit.
          pending.delete(logoUrl);
        }
        return trimmed;
      });
    pending.set(logoUrl, result);
  }
  return result;
}

/** An already-finished result without waiting; undefined if not done yet. */
export function peekTrimmedLogo(logoUrl: string): string | null | undefined {
  return finished.get(logoUrl);
}

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Asks the other site for permission to read the pixels.
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

/**
 * Small copies in this project's Supabase Storage (made by the admin page or `npm run logos`)
 * load straight from Supabase, which allows its public files to be read by
 * other sites. Everything else goes through app/api/logo/route.ts.
 */
function isOwnStorageUrl(logoUrl: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(
    supabaseUrl && logoUrl.startsWith(`${supabaseUrl}/storage/v1/object/public/`),
  );
}

export async function loadLogoImage(logoUrl: string): Promise<HTMLImageElement> {
  const viaRoute = `/api/logo?url=${encodeURIComponent(logoUrl)}`;
  if (!isOwnStorageUrl(logoUrl)) return loadImage(viaRoute);
  try {
    return await loadImage(logoUrl, true);
  } catch {
    return loadImage(viaRoute);
  }
}

async function trimLogo(logoUrl: string): Promise<string | null> {
  const trimmed = trimImage(await loadLogoImage(logoUrl));
  return trimmed ? trimmed.toDataURL("image/png") : null;
}

/**
 * The image cropped to its visible part and shrunk to at most OUTPUT_SIZE px,
 * or null if it is empty. Also used by the admin page before uploading a logo.
 */
export function trimImage(image: HTMLImageElement): HTMLCanvasElement | null {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) return null;

  // Find the logo's edges on a small copy.
  const scanScale = Math.min(1, SCAN_SIZE / Math.max(width, height));
  const scanWidth = Math.max(1, Math.round(width * scanScale));
  const scanHeight = Math.max(1, Math.round(height * scanScale));
  const scan = document.createElement("canvas");
  scan.width = scanWidth;
  scan.height = scanHeight;
  const scanContext = scan.getContext("2d", { willReadFrequently: true });
  if (!scanContext) return null;
  scanContext.drawImage(image, 0, 0, scanWidth, scanHeight);
  const pixels = scanContext.getImageData(0, 0, scanWidth, scanHeight).data;

  // Background is transparent, or else the colour of the top-left corner.
  const [bgR, bgG, bgB, bgA] = pixels;
  const transparentBackground = bgA < ALPHA_THRESHOLD;
  const isBackground = (i: number) =>
    transparentBackground
      ? pixels[i + 3] < ALPHA_THRESHOLD
      : pixels[i + 3] < ALPHA_THRESHOLD ||
        Math.abs(pixels[i] - bgR) +
          Math.abs(pixels[i + 1] - bgG) +
          Math.abs(pixels[i + 2] - bgB) <
          COLOR_THRESHOLD;

  let left = scanWidth;
  let top = scanHeight;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < scanHeight; y++) {
    for (let x = 0; x < scanWidth; x++) {
      if (isBackground((y * scanWidth + x) * 4)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null; // nothing but background

  // Back to full-size coordinates, with a little breathing room.
  const pad = Math.round(Math.max(right - left, bottom - top) * KEEP_MARGIN);
  const cropX = Math.max(0, (left - pad) / scanScale);
  const cropY = Math.max(0, (top - pad) / scanScale);
  const cropWidth = Math.min(width, (right + 1 + pad) / scanScale) - cropX;
  const cropHeight = Math.min(height, (bottom + 1 + pad) / scanScale) - cropY;

  const outScale = Math.min(1, OUTPUT_SIZE / Math.max(cropWidth, cropHeight));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(cropWidth * outScale));
  output.height = Math.max(1, Math.round(cropHeight * outScale));
  const outputContext = output.getContext("2d");
  if (!outputContext) return null;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    output.width,
    output.height,
  );
  return output;
}
