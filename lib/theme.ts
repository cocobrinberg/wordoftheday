/**
 * Builds a whole color scheme from the one background color a user picks.
 *
 * Components use Tailwind's `stone` scale for text and borders and the `amber`
 * scale for accents. Tailwind reads those from CSS variables, so overriding
 * the variables re-themes every page at once:
 *  - stone becomes a neutral gently tinted toward the chosen hue,
 *  - amber becomes a full accent scale in a deeper shade of that hue,
 *  - --ink (headings, primary buttons) becomes a near-black of that hue.
 * Neutral picks (white, sand) keep the default warm-amber look.
 */

type Oklch = { l: number; c: number; h: number };

function hexToOklch(hex: string): Oklch {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((n >> 16) & 255);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

const css = (l: number, c: number, h: number) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
// Lightness and chroma per step, modelled on Tailwind's own scales.
const NEUTRAL_L = [0.985, 0.97, 0.923, 0.869, 0.709, 0.553, 0.444, 0.374, 0.268, 0.216, 0.147];
const ACCENT_L = [0.982, 0.955, 0.91, 0.855, 0.78, 0.7, 0.6, 0.5, 0.43, 0.37, 0.26];
const ACCENT_C = [0.02, 0.05, 0.095, 0.13, 0.15, 0.16, 0.155, 0.14, 0.12, 0.1, 0.07];

export const THEME_VARS = [
  "--page-bg",
  "--ink",
  "--accent",
  "--accent-soft",
  ...STEPS.flatMap((s) => [`--color-stone-${s}`, `--color-amber-${s}`]),
];

/** CSS variables for a background color; null values fall back to the stylesheet. */
export function themeFor(hex: string): Record<string, string | null> {
  const vars: Record<string, string | null> = Object.fromEntries(THEME_VARS.map((v) => [v, null]));
  const bg = hexToOklch(hex);

  // Too dark to read text on: use a pale wash of that color for the page instead.
  vars["--page-bg"] = bg.l < 0.82 ? css(0.965, Math.min(bg.c, 0.035), bg.h) : hex;

  // White, gray and other near-neutral picks keep the default palette.
  if (bg.c < 0.012) return vars;

  const h = bg.h;
  // Pale yellows make muddy olive accents; nudge them toward a golden amber.
  const accentH = h > 85 && h < 115 ? 70 : h;
  const tint = Math.min(0.018, bg.c * 0.6);

  STEPS.forEach((step, i) => {
    vars[`--color-stone-${step}`] = css(NEUTRAL_L[i], tint * (i < 2 ? 0.6 : 1), h);
    vars[`--color-amber-${step}`] = css(ACCENT_L[i], ACCENT_C[i], accentH);
  });
  vars["--ink"] = css(0.22, 0.035, h);
  vars["--accent"] = css(ACCENT_L[7], ACCENT_C[7], accentH);
  vars["--accent-soft"] = css(ACCENT_L[1], ACCENT_C[1], accentH);
  return vars;
}

/** Apply a background color's scheme to the whole page. */
export function applyTheme(hex: string) {
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(themeFor(hex))) {
    if (value) style.setProperty(name, value);
    else style.removeProperty(name);
  }
}
