import { listClockSfxPresets } from '$lib/resources/server/clock-sfx-presets.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model.js';

export async function load({ params }){
    return {
        clocks: getBOTCTClockInstanceManager().listInstances(),
        clockSfxPresets: listClockSfxPresets()
    }
}