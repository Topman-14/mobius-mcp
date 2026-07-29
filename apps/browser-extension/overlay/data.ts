export const OVERLAY_HOST_ID = "mobius-mcp-overlay-host";

export const CURSOR_SIZE_PX = 28;
export const CURSOR_MOVE_MS = 220;
export const CURSOR_COLOR = "#0a0a0a";
export const CURSOR_GLOW_COLOR = "#4cff3d";

// Phosphor "Cursor" icon, fill weight, inlined (MIT) to avoid an extension-resource fetch
// from a MAIN-world page context.
export const CURSOR_VIEW_BOX = "0 0 256 256";
export const CURSOR_SPARKLE_PATH =
  "M220.49,207.8,207.8,220.49a12,12,0,0,1-17,0l-56.57-56.57L115,214.08l-.13.33A15.84,15.84,0,0,1,100.26,224l-.78,0a15.82,15.82,0,0,1-14.41-11L32.8,52.92A15.95,15.95,0,0,1,52.92,32.8L213,85.07a16,16,0,0,1,1.41,29.8l-.33.13-50.16,19.27,56.57,56.56A12,12,0,0,1,220.49,207.8Z";

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
