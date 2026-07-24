export const OVERLAY_HOST_ID = "mobius-mcp-overlay-host";

export const CURSOR_SIZE_PX = 28;
export const CURSOR_MOVE_MS = 220;
export const CURSOR_COLOR = "#0a0a0a";
export const CURSOR_GLOW_COLOR = "#4cff3d";

// Four-pointed concave "kite"/sparkle silhouette, viewBox 0 0 24 24. One shape today;
// Stage I is expected to swap this per action type (pointer vs. text-entry vs. scroll) once
// the action tools exist to drive it — not built yet, see ROADMAP.md Stage I5.
export const CURSOR_SPARKLE_PATH = "M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z";

export const HUD_MAX_LOG_ENTRIES = 50;
export const HUD_COLLAPSED_SIZE_PX = 44;
export const HUD_EXPANDED_WIDTH_PX = 300;
export const HUD_EXPANDED_HEIGHT_PX = 220;

// Same infinity mark as public/icons/icon.svg, inlined so the HUD doesn't need an
// extension-resource fetch from a MAIN-world page context.
export const MOBIUS_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="20" height="20">
  <g transform="translate(128 0) scale(0.8 1) translate(-128 0)">
    <path fill="${CURSOR_GLOW_COLOR}" d="M252,128a60,60,0,0,1-102.43,42.43l-.49-.53L89.22,102.31a36,36,0,1,0,0,51.38l3.08-3.48a12,12,0,1,1,18,15.91l-3.35,3.78-.49.53a60,60,0,1,1,0-84.86l.49.53,59.86,67.59a36,36,0,1,0,0-51.38l-3.08,3.48a12,12,0,1,1-18-15.91l3.35-3.78.49-.53A60,60,0,0,1,252,128Z" />
  </g>
</svg>`;
