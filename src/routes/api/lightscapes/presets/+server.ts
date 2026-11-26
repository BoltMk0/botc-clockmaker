import { error, json } from '@sveltejs/kit';
import { createLightingPreset, listLightingPresets } from '$lib/lighting/server/presets';
import { getLightingService } from '$lib/lighting/server/service';

export async function GET() {
    return json(listLightingPresets());
}

/** A new, empty preset. */
export async function POST({ request }) {
    const { name } = await request.json() as { name?: unknown };
    if (typeof name !== 'string' || !name.trim()) error(400, 'Give it a name');
    const preset = createLightingPreset(name.trim());
    // The first preset is every game's default
    getLightingService().presetChanged();
    return json(preset);
}
