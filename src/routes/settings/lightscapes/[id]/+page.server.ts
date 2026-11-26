import { error } from '@sveltejs/kit';
import { getLightingPreset } from '$lib/lighting/server/presets';

export async function load({ params }){
    const preset = getLightingPreset(params.id);
    if(!preset) error(404, 'Lighting preset not found');
    return { preset };
}
