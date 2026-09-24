import { getSpotifyHelperInstance } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { error } from '@sveltejs/kit';

/**
 * Remote-control the player: { action: 'play' | 'pause' | 'next' | 'previous' }, { action: 'volume', volume: 0..100 },
 * { action: 'playContext', uri } or { action: 'playPhasePreset', presetId }
 */
export async function POST({ request }) {
    const command = await request.json().catch(() => null);
    if (typeof command !== 'object' || command === null || typeof command.action !== 'string') {
        return error(400, { message: 'Invalid body' });
    }
    try {
        await getSpotifyHelperInstance().control(command);
    } catch (e) {
        return error(502, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}
