// Mirrors the @media breakpoints in assets/css; CSS cannot read these constants.
export const QUERIES = Object.freeze({
  hover: "(any-hover: hover)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  aboutDesktop: "(min-width: 881px)",
  tablet: "(max-width: 900px)",
  homeDesktop: "(min-width: 901px)",
  tocCollapsed: "(max-width: 1200px)",
  archivePreview: "(min-width: 1201px)",
  gallerySequence: "(min-width: 769px) and (hover: hover) and (pointer: fine)",
});
