import { getMusicHelperInstance } from '$lib/model/server/Music/MusicHelper';
import { error } from '@sveltejs/kit';

/**
 * Remote-control the music player: { action: 'play' | 'pause' | 'next' | 'previous' }, { action: 'gain', gain } (linear),
 * { action: 'playPreset', presetId }, { action: 'schedulePreset', presetId | null } or
 * { action: 'moveTrack', playlistId, trackId, to } (to: the place in what's coming up, 0 to play next)
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
