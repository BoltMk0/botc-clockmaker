// Color/lighting tuning specific to the 3D clocktower scene. Kept separate
// from $lib/common/util's getSkyColor (used by the older SVG-based display)
// so tuning one scene's look never bleeds into the other's.

type ColorPoint = { progress: number; r: number; g: number; b: number };

// Shared by getSceneSkyColor and getSceneAmbientColor: finds the two
// keyframes `progress` falls between in an ascending-`progress` list and
// linearly interpolates each channel.
function interpolateColorPoints(points: ColorPoint[], progress: number): Rgb {
    let lowerPoint = points[0];
    let upperPoint = points[points.length - 1];

    for (let i = 0; i < points.length - 1; i++) {
        if (progress >= points[i].progress && progress <= points[i + 1].progress) {
            lowerPoint = points[i];
            upperPoint = points[i + 1];
            break;
        }
    }

    const range = upperPoint.progress - lowerPoint.progress;
    const factor = (progress - lowerPoint.progress) / range;

    return {
        r: Math.round(lowerPoint.r + factor * (upperPoint.r - lowerPoint.r)),
        g: Math.round(lowerPoint.g + factor * (upperPoint.g - lowerPoint.g)),
        b: Math.round(lowerPoint.b + factor * (upperPoint.b - lowerPoint.b))
    };
}

const sky_color_points: ColorPoint[] = [
    { progress: 0, r: 140, g: 162, b: 183 },    // Dawn - pale, hazy blue (a touch darker)
    { progress: 0.4, r: 150, g: 195, b: 230 },  // Morning - clear pale blue
    { progress: 0.7, r: 100, g: 160, b: 220 },  // Midday - deeper, more saturated blue
    { progress: 0.85, r: 156, g: 172, b: 200 }, // Late afternoon - starting to warm and soften
    { progress: 0.93, r: 235, g: 150, b: 110 }, // Sunset - warm orange
    { progress: 0.97, r: 90, g: 65, b: 100 },   // Dusk - deep purple twilight
    { progress: 1.0, r: 40, g: 42, b: 66 },     // Night - true dark navy blue
];

export function getSceneSkyColor(progress: number): string {
    const { r, g, b } = interpolateColorPoints(sky_color_points, progress);
    return `rgb(${r}, ${g}, ${b})`;
}

// Tuned separately from the sky's own gradient (see sky_color_points above):
// during the day it's a much paler, less saturated version of the sky's own
// blue - a fully-saturated sky-blue ambient fill washes the whole (already
// lit by the warm sun) scene out toward blue/grey, whereas real daylight
// ambient (bounced/scattered skylight) reads as closer to neutral white with
// only a faint cool cast. It diverges further from dusk onward: the sky
// gradient keeps fading toward a near-black navy (it's a background
// painting, so it can go as dark as it likes); the ambient light is what
// keeps the tower's unlit/shadowed relief readable overnight (see
// Sky.svelte's `GI_FLOOR`/`moonAppearAmount` boost), so it settles on a
// paler, cooler moonlit tone instead of tracking the sky down toward black.
const ambient_color_points: ColorPoint[] = [
    { progress: 0, r: 190, g: 198, b: 206 },    // Dawn - just a faint cool cast
    { progress: 0.4, r: 205, g: 220, b: 232 },  // Morning - light and airy, not saturated blue
    { progress: 0.7, r: 195, g: 212, b: 230 },  // Midday - brightest, but still fairly neutral
    { progress: 0.85, r: 195, g: 200, b: 210 }, // Late afternoon - pale, near-neutral
    { progress: 0.93, r: 210, g: 160, b: 140 }, // Sunset - warm, but less saturated than the sky's own orange
    { progress: 0.97, r: 120, g: 110, b: 150 }, // Dusk - cool violet twilight
    { progress: 1.0, r: 120, g: 105, b: 120 },   // Night - pale, cool moonlit slate-blue
];

export function getSceneAmbientColor(progress: number): Rgb {
    return interpolateColorPoints(ambient_color_points, progress);
}

// The sun's disc color as it climbs from the horizon (progress 0) to its
// zenith at the middle of its arc (progress 0.5) and back down to the
// horizon (progress 1) - matching real sunlight, which reddens and dims as
// it passes through more atmosphere near the horizon, and looks close to a
// bright, nearly-desaturated white/yellow high in the sky.
export function getSceneSunColor(progress: number): string {
    const p = Math.min(Math.max(progress, 0), 1);
    // 0 at the zenith, 1 at the horizon.
    const fromHorizon = Math.abs(p - 0.5) * 2;
    // Eased so the disc stays crisp and pale near noon but starts warming up
    // well before the horizon (a lower exponent than before - it should
    // already read as "setting" partway through the afternoon, not just in
    // the last sliver of its arc).
    const eased = fromHorizon ** 1.3;

    const hue = 48 - eased * 30; // 48° warm yellow -> 18° hot orange
    const saturation = 30 + eased * 65; // 30% (warm white) -> 95% (richly saturated)
    const lightness = 88 - eased * 18; // 88% (bright, warm white) -> 70% (bright, warm, still glowing)

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// How "daylit" the scene is: 1 through most of the countdown, easing down to
// 0 over the final third as the timer runs out.
export function getSceneSkyBrightness(progress: number): number {
    return Math.pow(1 - Math.max(0, progress * 3 - 2), 2);
}

export type Rgb = { r: number; g: number; b: number };

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
    const amount = Math.min(Math.max(t, 0), 1);
    return {
        r: Math.round(a.r * (1 - amount) + b.r * amount),
        g: Math.round(a.g * (1 - amount) + b.g * amount),
        b: Math.round(a.b * (1 - amount) + b.b * amount)
    };
}

// The moon starts out pale and silvery when it first appears in the evening
// twilight, then deepens into a full blood red once night has properly
// settled in. Shared with the faint tint it and the sun lend the sky (real
// skies pick up color from whatever's lighting them).
export const MOON_RISING_CORE_COLOR: Rgb = { r: 232, g: 232, b: 240 };
export const MOON_RISING_GLOW_COLOR: Rgb = { r: 255, g: 255, b: 255 };
export const MOON_CORE_COLOR: Rgb = { r: 122, g: 20, b: 16 };
export const MOON_GLOW_COLOR: Rgb = { r: 180, g: 70, b: 55 };

// A soft, light pink the blood moon's disc (and the clockface echoing it)
// are pulled toward so they read rosy rather than as a flat red filter.
export const MOON_DISC_PINK: Rgb = { r: 255, g: 150, b: 165 };

// The lanterns' warm amber glow - matches the lit glass panes in their own
// art. Shared with anything else that wants to read as "lit by lantern
// light" (e.g. the count banner's fill light) rather than a plain white.
export const LANTERN_GLOW_COLOR: Rgb = { r: 255, g: 186, b: 107 };
