import { listAmbienceResources } from '$lib/resources/server/ambience-resources';
import { listClockSfxPresets } from '$lib/resources/server/clock-sfx-presets';
import { listResources } from '$lib/resources/server/resources';

export async function load(){
    return {
        clockSfxPresets: listClockSfxPresets(),
        ambienceResources: listAmbienceResources(),
        stingResources: listResources('sting')
    };
}
