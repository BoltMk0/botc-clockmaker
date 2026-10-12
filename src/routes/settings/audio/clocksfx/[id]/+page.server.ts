import { error } from '@sveltejs/kit';
import { ACCEPTED_CLOCK_SFX_EXTENSIONS, getClockSfxPreset } from '$lib/resources/server/clock-sfx-presets';

export async function load({ params }){
    const preset = getClockSfxPreset(params.id);
    if(!preset) error(404, 'Clock SFX preset not found');
    return {
        preset,
        acceptedExtensions: ACCEPTED_CLOCK_SFX_EXTENSIONS
    };
}
