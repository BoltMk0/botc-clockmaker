import { getMixerMastersHelperInstance } from '$lib/model/server/MixerMasters/MixerMastersHelper.js';
import { error, json } from '@sveltejs/kit';

export function GET() {
    return json(getMixerMastersHelperInstance().model);
}

/** Patch the shared master faders: { mainGain?: number, clocksGain?: number, clocksPan?: number } (gains linear) */
export async function POST({ request }) {
    const patch = await request.json().catch(() => null);
    if (typeof patch !== 'object' || patch === null) return error(400, { message: 'Invalid body' });
    try {
        getMixerMastersHelperInstance().update(patch);
    } catch (e) {
        return error(400, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
