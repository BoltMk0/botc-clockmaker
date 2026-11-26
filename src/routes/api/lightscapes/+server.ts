import { json } from '@sveltejs/kit';
import { getLightingService } from '$lib/lighting/server/service';
import { getDefaultLightingPresetId, listLightingPresets } from '$lib/lighting/server/presets';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

/** The hubs (with whether they're online, their lights and the game each follows), the lighting presets and the games. */
export async function GET() {
    return json({
        hubs: getLightingService().hubs(),
        presets: listLightingPresets().map(p => ({ id: p.id, name: p.name })),
        defaultPresetId: getDefaultLightingPresetId(),
        games: getBOTCTClockInstanceManager().listInstances().map(m => ({
            id: m.clock.clockId,
            name: m.config.teamName ?? 'A game',
            lightingPresetId: m.config.lightingPresetId ?? null
        }))
    });
}
