export const FONT_MONO = '"JetBrains Mono", "Geist Mono", monospace';
const STAGGER = 35;

export function staggerFontChange(chars, applyChange) {
  return chars.map((char, i) =>
    setTimeout(() => {
      applyChange(char);
    }, i * STAGGER),
  );
}
