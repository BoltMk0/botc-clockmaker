import { getStingEngineHelperInstance } from '$lib/model/server/StingEngine/StingEngineHelper.js';
import { error } from '@sveltejs/kit';

/** Patch engine-level state: { gain?, pan? } */
export async function POST({ request }) {
    const patch = await request.json().catch(() => null);
    if (typeof patch !== 'object' || patch === null) return error(400, { message: 'Invalid body' });
    try {
        getStingEngineHelperInstance().updateEngine(patch);
    } catch (e) {
        return error(400, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
