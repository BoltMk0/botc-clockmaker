import { sky_color_points } from "../../src/lib/components/ClocktowerScene/sceneColors.ts";
import type { SpectrumStop } from "./config.ts";

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
    return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** The colour and brightness `progress` (0-1) of the way through the day, between the stops either side of it. */
export function spectrumAt(stops: readonly SpectrumStop[], progress: number): { hex: string; brightness: number } {
    if(stops.length === 0) throw new Error('A spectrum needs at least one stop');
    const p = Math.min(Math.max(progress, 0), 1);
    if(p <= stops[0].at) return { hex: stops[0].hex, brightness: stops[0].brightness };
    const last = stops[stops.length - 1];
    if(p >= last.at) return { hex: last.hex, brightness: last.brightness };

    let i = 0;
    while(p > stops[i + 1].at) i++;
    const lower = stops[i];
    const upper = stops[i + 1];
    const t = upper.at === lower.at ? 1 : (p - lower.at) / (upper.at - lower.at);
    const a = hexToRgb(lower.hex);
    const b = hexToRgb(upper.hex);
    return {
        hex: rgbToHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }),
        brightness: Math.round(lower.brightness + (upper.brightness - lower.brightness) * t)
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
        brightness: Math.max(1, Math.round(Math.max(point.r, point.g, point.b) / 255 * 254))
    }));
}
