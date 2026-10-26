export const QUERIES = Object.freeze({
  hover: "(any-hover: hover)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  darkScheme: "(prefers-color-scheme: dark)",
  mobile: "(max-width: 768px)",
  aboutDesktop: "(min-width: 881px)",
  tablet: "(max-width: 900px)",
  homeDesktop: "(min-width: 901px)",
  tocCollapsed: "(max-width: 1200px)",
});

export function media(query) {
  return window.matchMedia(query);
}

export function matches(query) {
  return window.matchMedia(query).matches;
}
