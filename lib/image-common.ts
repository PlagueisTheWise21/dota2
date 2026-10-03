import { getTrimmedLogo } from "@/lib/logo-trim";

/**
 * Canvas drawing helpers shared by the "Copy image" pictures
 * (lib/tier-image.ts and lib/prediction-image.ts). Browser-only.
 */

export const COLORS = {
  ink: "#0b0b0b",
  panel: "#161616",
  paper: "#e8ecf1",
  shadow: "#4a607a",
  card: "#202020",
  cardOutline: "rgba(232, 236, 241, 0.6)",
  cardDivider: "rgba(232, 236, 241, 0.3)",
  labelGrey: "#2a2a2a",
  black: "#000000",
};

/** Space around everything in the image, in px. */
export const PADDING = 32;
/** Space between the title box and what is below it. */
export const TITLE_GAP = 24;
export const TITLE_HEIGHT = 72;
/** Solid offset shadow of the big boxes (shadow-offset on the page). */
export const PANEL_SHADOW = 6;
/** Solid offset shadow of team cards. */
export const CARD_SHADOW = 2;
/** Outline of team cards. */
export const CARD_BORDER = 1;
const TITLE_BORDER = 2;

export type Fonts = { display: string; body: string };

/** Font families as the page resolved them (next/font gives generated names). */
export async function loadFonts(): Promise<Fonts> {
  const probe = document.createElement("span");
  probe.className = "font-display";
  document.body.appendChild(probe);
  const display = getComputedStyle(probe).fontFamily;
  probe.remove();
  const body = getComputedStyle(document.body).fontFamily;
  await Promise.all([
    document.fonts.load(`700 30px ${display}`),
    document.fonts.load(`600 11px ${body}`),
    document.fonts.load(`500 13px ${body}`),
  ]);
  return { display, body };
}

/**
 * The trimmed logo (lib/logo-trim.ts, shared with the cards on the page);
 * null if there is none or it fails, which draws the short name instead.
 */
export async function loadLogo(
  logoUrl: string | null,
): Promise<HTMLImageElement | null> {
  if (!logoUrl) return null;
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 10000),
  );
  const trimmed = await Promise.race([getTrimmedLogo(logoUrl), timeout]);
  if (!trimmed) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = trimmed;
  });
}

/** Splits text into at most `maxLines` lines that fit `maxWidth`. */
export function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  // Break on spaces, and inside words that are too long on their own.
  const pieces = text.split(" ").flatMap((word) => {
    if (context.measureText(word).width <= maxWidth) return [word];
    const parts: string[] = [];
    let part = "";
    for (const char of word) {
      if (context.measureText(part + char).width > maxWidth && part) {
        parts.push(part);
        part = char;
      } else {
        part += char;
      }
    }
    return [...parts, part];
  });

  for (const piece of pieces) {
    const next = line ? `${line} ${piece}` : piece;
    if (context.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = piece;
    }
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && context.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** Draws with letter spacing where the browser supports it on canvas. */
export function withLetterSpacing(
  context: CanvasRenderingContext2D,
  spacing: string,
  draw: () => void,
) {
  const supported = "letterSpacing" in context;
  if (supported) context.letterSpacing = spacing;
  draw();
  if (supported) context.letterSpacing = "0px";
}

/** A filled box with an optional solid offset shadow and an inset border. */
export function drawBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fill: string;
    border: number;
    /** Defaults to black. A see-through colour is blended over `fill`, as in CSS. */
    borderColor?: string;
    shadow?: { offset: number; color: string };
  },
) {
  if (options.shadow) {
    context.fillStyle = options.shadow.color;
    context.fillRect(
      x + options.shadow.offset,
      y + options.shadow.offset,
      width,
      height,
    );
  }
  context.fillStyle = options.fill;
  context.fillRect(x, y, width, height);
  context.strokeStyle = options.borderColor ?? COLORS.black;
  context.lineWidth = options.border;
  context.strokeRect(
    x + options.border / 2,
    y + options.border / 2,
    width - options.border,
    height - options.border,
  );
}

/** A team card's box: dark, thin light outline, small black offset shadow. */
export function drawCardBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  drawBox(context, x, y, width, height, {
    fill: COLORS.card,
    border: CARD_BORDER,
    borderColor: COLORS.cardOutline,
    shadow: { offset: CARD_SHADOW, color: COLORS.black },
  });
}

/**
 * A logo fitted inside a box, keeping its shape; the team's short name in
 * the box's middle when there is no logo.
 */
export function drawLogo(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  logo: HTMLImageElement | null,
  fallbackText: string,
  fallbackSize: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (logo) {
    const fit = Math.min(width / logo.naturalWidth, height / logo.naturalHeight);
    const drawWidth = logo.naturalWidth * fit;
    const drawHeight = logo.naturalHeight * fit;
    context.drawImage(
      logo,
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    return;
  }
  context.fillStyle = COLORS.paper;
  context.font = `700 ${fallbackSize}px ${fonts.display}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fallbackText.toUpperCase(), x + width / 2, y + height / 2, width);
}

/** A canvas of `width` x `height` px (times pixelRatio), filled with the page colour. */
export function createCanvas(width: number, height: number, pixelRatio: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = COLORS.ink;
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

/**
 * The title box at the top of an image: event name with a small subtitle
 * underneath ("TIER LIST", "PREDICTIONS"), centred, at most `maxWidth` wide.
 */
export function drawTitle(
  context: CanvasRenderingContext2D,
  fonts: Fonts,
  canvasWidth: number,
  maxWidth: number,
  eventName: string,
  subtitle: string,
) {
  const titleText = eventName.toUpperCase();
  context.font = `700 30px ${fonts.display}`;
  const titleWidth = Math.min(
    maxWidth,
    Math.ceil(context.measureText(titleText).width) + 80,
  );

  drawBox(context, (canvasWidth - titleWidth) / 2, PADDING, titleWidth, TITLE_HEIGHT, {
    fill: COLORS.panel,
    border: TITLE_BORDER,
    borderColor: COLORS.cardOutline,
    shadow: { offset: PANEL_SHADOW, color: COLORS.shadow },
  });
  context.fillStyle = COLORS.paper;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 30px ${fonts.display}`;
  context.fillText(titleText, canvasWidth / 2, PADDING + 28, maxWidth - 40);
  context.font = `500 13px ${fonts.body}`;
  withLetterSpacing(context, "3px", () =>
    context.fillText(subtitle.toUpperCase(), canvasWidth / 2, PADDING + 54),
  );
}

/** The canvas as a PNG. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image was empty"))),
      "image/png",
    );
  });
}
