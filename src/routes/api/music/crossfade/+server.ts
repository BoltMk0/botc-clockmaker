import { getMusicHelperInstance } from '$lib/model/server/Music/MusicHelper';
import { error } from '@sveltejs/kit';

/** Patch the music player's crossfading: { enabled?: boolean, seconds?: number } */
export async function POST({ request }) {
    const patch = await request.json().catch(() => null);
    if (typeof patch !== 'object' || patch === null) return error(400, { message: 'Invalid body' });
    try {
        getMusicHelperInstance().updateCrossfade(patch);
    } catch (e) {
        return error(400, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
