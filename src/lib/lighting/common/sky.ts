import { hexToKelvin, rgbToHex } from "@boltmk0/lightscapes/color";
import { sky_color_points } from "$lib/components/ClocktowerScene/sceneColors";
import type { SpectrumStop } from "./lightingPreset";

/**
 * The town square's sky, as a spectrum's colours. A bulb takes its colour's hue from the colour but its brightness
 * separately, so each colour's brightness follows how light the sky is there, dimming into the dusk as the sky darkens.
 */
export function townSquareStops(): SpectrumStop[] {
    return sky_color_points.map(point => {
        const hex = rgbToHex(point);
        return {
            at: point.progress,
            white: true,
            hex,
            kelvin: hexToKelvin(hex),
            brightness: Math.max(1 / 254, Math.max(point.r, point.g, point.b) / 255)
        };
    });
}
