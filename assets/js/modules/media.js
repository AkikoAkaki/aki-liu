// Shared media queries. Breakpoints mirror the CSS @media rules that pair
// with each script; change both together.
export const QUERIES = Object.freeze({
  hover: "(any-hover: hover)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  darkScheme: "(prefers-color-scheme: dark)",
  // Microblog deck and About image sequence switch to their mobile layout.
  mobile: "(max-width: 768px)",
  // About pinboard flight-and-drag runs only on desktop.
  aboutDesktop: "(min-width: 881px)",
  // Post TOC mobile layout.
  tablet: "(max-width: 900px)",
  // Homepage nav gap sizing (the complement of `tablet`).
  homeDesktop: "(min-width: 901px)",
  // Post TOC leaves the right sidebar.
  tocCollapsed: "(max-width: 1200px)",
});

export function media(query) {
  return window.matchMedia(query);
}

export function matches(query) {
  return window.matchMedia(query).matches;
}
