import { error, json } from '@sveltejs/kit';
import { deleteLightingPreset, duplicateLightingPreset, getLightingPreset, saveLightingPreset } from '$lib/lighting/server/presets';
import { LightingPresetError } from '$lib/lighting/common/lightingPreset';
import { getLightingService } from '$lib/lighting/server/service';

export async function GET({ params }) {
    const preset = getLightingPreset(params.id);
    if (!preset) error(404, 'No such preset');
    return json(preset);
}

/** Saves the preset from the editor; the games using it are sent it at once. */
export async function PUT({ params, request }) {
    try {
        const preset = saveLightingPreset(params.id, await request.json());
        if (!preset) error(404, 'No such preset');
        getLightingService().presetChanged();
        return json(preset);
    } catch (err) {
        if (err instanceof LightingPresetError) error(400, err.message);
        throw err;
    }
}

export async function POST({ params }) {
    const preset = duplicateLightingPreset(params.id);
    if (!preset) error(404, 'No such preset');
    return json(preset);
}

/** Games using it go back to the default preset. */
export async function DELETE({ params }) {
    if (!deleteLightingPreset(params.id)) error(404, 'No such preset');
    getLightingService().presetChanged();
    return new Response(null, { status: 204 });
}
