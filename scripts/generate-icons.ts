// Rasterizes the Goldwater Care icon (public/icons/icon.svg — a sky-blue mark on
// a navy circle) into the PNG sizes the manifest and iOS need. Run `npm run icons`.
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ICONS_DIR = join(process.cwd(), "public", "icons");
const svg = readFileSync(join(ICONS_DIR, "icon.svg"));
const NAVY = "#00263c";

// Icon centered on a full-bleed navy square (for maskable + iOS, which don't
// like transparency). The circle blends into the navy, leaving the sky mark.
async function iconOnNavy(size: number, ratio: number) {
  const iconPx = Math.round(size * ratio);
  const icon = await sharp(svg)
    .resize(iconPx, iconPx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: icon, gravity: "center" }])
    .png();
}

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true });
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  await sharp(svg).resize(192, 192, { fit: "contain", background: transparent }).png().toFile(join(ICONS_DIR, "icon-192.png"));
  await sharp(svg).resize(512, 512, { fit: "contain", background: transparent }).png().toFile(join(ICONS_DIR, "icon-512.png"));
  await (await iconOnNavy(512, 0.92)).toFile(join(ICONS_DIR, "maskable-512.png"));
  await (await iconOnNavy(180, 0.92)).toFile(join(ICONS_DIR, "apple-touch-icon.png"));
  console.log("Generated PNG icons in public/icons/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
