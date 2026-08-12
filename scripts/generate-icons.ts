// Rasterizes the SVG app icon into the PNG sizes the manifest and iOS need.
// Run with `npm run icons` (uses sharp). Safe to re-run.
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ICONS_DIR = join(process.cwd(), "public", "icons");
const svg = readFileSync(join(ICONS_DIR, "icon.svg"));

// A maskable icon needs its content inside the safe zone, so we render the
// logo onto a full-bleed brand background with generous padding.
const maskableSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#236b59"/>
  <g transform="translate(96 96) scale(0.625)">${readFileSync(join(ICONS_DIR, "icon.svg"))
    .toString()
    .replace(/<\?xml.*?\?>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")}</g>
</svg>`);

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true });
  await sharp(svg).resize(192, 192).png().toFile(join(ICONS_DIR, "icon-192.png"));
  await sharp(svg).resize(512, 512).png().toFile(join(ICONS_DIR, "icon-512.png"));
  await sharp(svg).resize(180, 180).png().toFile(join(ICONS_DIR, "apple-touch-icon.png"));
  await sharp(maskableSvg).resize(512, 512).png().toFile(join(ICONS_DIR, "maskable-512.png"));
  console.log("Generated PNG icons in public/icons/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
