import { getAudioDimHelperInstance } from '$lib/model/server/AudioDim/AudioDimHelper.js';
import { error, json } from '@sveltejs/kit';

export function GET() {
    return json(getAudioDimHelperInstance().model);
}

/** Patch the dim state: { dimmed?: boolean, amountDb?: number } */
export async function POST({ request }) {
    const patch = await request.json().catch(() => null);
    if (typeof patch !== 'object' || patch === null) return error(400, { message: 'Invalid body' });
    try {
        getAudioDimHelperInstance().update(patch);
    } catch (e) {
        return error(400, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
