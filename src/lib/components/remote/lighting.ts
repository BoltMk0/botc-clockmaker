import type { LightOverride } from "$lib/model/common/ClocktowerClockModel";
// Lightscapes' own whites, so the remote shows the white the lights are sent
import { COOLEST, WARMEST, miredsToHex } from "../../../../lightscapes/public/whites.js";

export { COOLEST, WARMEST, miredsToHex };

/** The colour an override shows as, at full brightness, like #ffaa00. */
export function overrideHex(override: LightOverride): string {
    return override.color.kind === 'rgb' ? override.color.hex : miredsToHex(override.color.mireds);
}
