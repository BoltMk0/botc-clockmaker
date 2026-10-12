import { getTimeOfDayTrimHelperInstance } from '$lib/model/server/TimeOfDayTrim/TimeOfDayTrimHelper.js';
import { error, json } from '@sveltejs/kit';

export function GET() {
    return json(getTimeOfDayTrimHelperInstance().model);
}

/** Patch the per-phase master trims: { day?: number, dusk?: number, night?: number } in dB */
export async function POST({ request }) {
    const patch = await request.json().catch(() => null);
    if (typeof patch !== 'object' || patch === null) return error(400, { message: 'Invalid body' });
    try {
        getTimeOfDayTrimHelperInstance().update(patch);
    } catch (e) {
        return error(400, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
