import { error, json } from '@sveltejs/kit';
import { deleteClockSfxPreset, getClockSfxPreset, updateClockSfxPreset } from '$lib/resources/server/clock-sfx-presets';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function GET({ params }){
    const preset = getClockSfxPreset(params.id);
    if(!preset) return error(404, { message: 'Clock SFX preset not found' });
    return json(preset);
}

/** Updates the name and gain/balance/pan trim. The sounds are uploaded separately, via ./[slot]. */
export async function PUT({ params, request }){
    const body = await request.json();
    if(typeof body?.name !== 'string' || typeof body.gain !== 'number' || typeof body.balance !== 'number' || typeof body.pan !== 'number'){
        return error(400, { message: 'Expected {name, gain, balance, pan}' });
    }
    const preset = updateClockSfxPreset(params.id, {
        name: body.name.trim() || 'Unnamed',
        gain: Math.min(1, Math.max(0, body.gain)),
        balance: Math.min(1, Math.max(-1, body.balance)),
        pan: Math.min(1, Math.max(-1, body.pan))
    });
    if(!preset) return error(404, { message: 'Clock SFX preset not found' });
    getBOTCTClockInstanceManager().refreshClockSfxPreset(preset.id);
    return json(preset);
}

export async function DELETE({ params }){
    if(!deleteClockSfxPreset(params.id)) return error(404, { message: 'Clock SFX preset not found' });
    getBOTCTClockInstanceManager().reassignDeletedClockSfxPreset(params.id);
    return new Response(null, { status: 204 });
}
