import { getMusicHelperInstance } from '$lib/model/server/Music/MusicHelper';
import { error } from '@sveltejs/kit';

/**
 * Remote-control the music player: { action: 'play' | 'pause' | 'next' | 'previous' }, { action: 'volume', volume: 0..100 },
 * { action: 'playPreset', presetId } or { action: 'schedulePreset', presetId | null }
 */
export async function POST({ request }) {
    const command = await request.json().catch(() => null);
    if (typeof command !== 'object' || command === null || typeof command.action !== 'string') {
        return error(400, { message: 'Invalid body' });
    }
    try {
        getMusicHelperInstance().control(command);
    } catch (e) {
        return error(409, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
