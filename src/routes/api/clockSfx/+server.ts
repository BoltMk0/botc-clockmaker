import { json } from '@sveltejs/kit';
import { createClockSfxPreset, listClockSfxPresets } from '$lib/resources/server/clock-sfx-presets';

export async function GET(){
    return json(listClockSfxPresets());
}

export async function POST({ request }){
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'New Clock SFX Preset';
    return json(createClockSfxPreset(name), { status: 201 });
}
