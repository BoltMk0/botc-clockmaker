import { json } from '@sveltejs/kit';
import { getLightingService } from '$lib/lighting/server/service';
import { getDefaultLightingPresetId, listLightingPresets } from '$lib/lighting/server/presets';

/** The hubs (with whether they're online, their lights and the game each follows) and the lighting presets. */
export async function GET() {
    return json({
        hubs: getLightingService().hubs(),
        presets: listLightingPresets().map(p => ({ id: p.id, name: p.name })),
        defaultPresetId: getDefaultLightingPresetId()
    });
}
