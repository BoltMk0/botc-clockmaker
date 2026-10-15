import { sky_color_points } from "../../src/lib/components/ClocktowerScene/sceneColors.ts";
import type { SpectrumStop } from "./config.ts";
import { hexToMireds, miredsToHex } from "../public/whites.js";

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
    return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** What the spectrum's lights are set to: a white (in mireds) or a colour, and how it shows, like #ffaa00. */
export type SpectrumColor = { hex: string; brightness: number; mireds: number | null };

/** A stop's colour as the lights show it: its white's, if it's white. */
function shown(stop: SpectrumStop): string {
    return stop.white ? miredsToHex(hexToMireds(stop.hex)) : stop.hex;
}

function atStop(stop: SpectrumStop): SpectrumColor {
    return { hex: shown(stop), brightness: stop.brightness, mireds: stop.white ? hexToMireds(stop.hex) : null };
}

/**
 * The colour and brightness `progress` (0-1) of the way through the day, between the stops either side of it. Between
 * two whites it fades by colour temperature, on the bulbs' white light; next to a colour, it fades in colour, from or
 * to the white's.
 */
export function spectrumAt(stops: readonly SpectrumStop[], progress: number): SpectrumColor {
    if(stops.length === 0) throw new Error('A spectrum needs at least one stop');
    const p = Math.min(Math.max(progress, 0), 1);
    if(p <= stops[0].at) return atStop(stops[0]);
    const last = stops[stops.length - 1];
    if(p >= last.at) return atStop(last);

    let i = 0;
    while(p > stops[i + 1].at) i++;
    const lower = stops[i];
    const upper = stops[i + 1];
    const t = upper.at === lower.at ? 1 : (p - lower.at) / (upper.at - lower.at);
    const brightness = Math.round(lower.brightness + (upper.brightness - lower.brightness) * t);
    if(lower.white && upper.white){
        const a = hexToMireds(lower.hex);
        const mireds = Math.round(a + (hexToMireds(upper.hex) - a) * t);
        return { hex: miredsToHex(mireds), brightness, mireds };
    }
    const a = hexToRgb(shown(lower));
    const b = hexToRgb(shown(upper));
    return {
        hex: rgbToHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }),
        brightness,
        mireds: null
    };
}

/**
 * The town square's sky, as stops. A bulb takes its colour's hue from the colour but its brightness separately, so
 * each stop's brightness follows how light the sky is there - dimming into the dusk as the sky darkens.
 */
export function townSquareSpectrum(): SpectrumStop[] {
    return sky_color_points.map(point => ({
        at: point.progress,
        hex: rgbToHex(point),
        brightness: Math.max(1, Math.round(Math.max(point.r, point.g, point.b) / 255 * 254)),
        white: true
    }));
}
