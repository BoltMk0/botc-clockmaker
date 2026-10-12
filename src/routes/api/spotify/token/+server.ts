import { getSpotifyHelperInstance } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { error, json } from '@sveltejs/kit';

/** Access token for the Web Playback SDK. Only handed to the client that currently hosts the player. Body: { clientId } */
export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null || typeof body.clientId !== 'string') {
        return error(400, { message: 'Invalid body' });
    }
    try {
        return json({ token: await getSpotifyHelperInstance().hostToken(body.clientId) });
    } catch (e) {
        return error(403, { message: e instanceof Error ? e.message : String(e) });
    }
}
