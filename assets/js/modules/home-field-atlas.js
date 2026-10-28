export const characters = " .,:-+AKILIU";

let fontReady;

export async function makeAtlas(cellWidth, cellHeight) {
  const font = `400 ${Math.max(1, cellHeight * 0.9)}px "JetBrains Mono", ui-monospace, monospace`;
  fontReady ||= document.fonts.load(font, characters);
  await fontReady.catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = characters.length * cellWidth;
  canvas.height = cellHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = font;
  const metrics = ctx.measureText("M");
  const ascent = metrics.actualBoundingBoxAscent || cellHeight * 0.9 * 0.7;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const baseline = (cellHeight + ascent - descent) / 2;
  Array.from(characters).forEach((char, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * cellWidth, 0, cellWidth, cellHeight);
    ctx.clip();
    ctx.translate(i * cellWidth + cellWidth / 2, baseline);
    const width = ctx.measureText(char).width;
    if (width > 0.96 * cellWidth) ctx.scale(0.96 * cellWidth / width, 1);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });
  return createImageBitmap(canvas, { premultiplyAlpha: "none" });
}
