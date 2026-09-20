import { getSpotifyHelperInstance } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { error } from '@sveltejs/kit';

async function readClientId(request: Request) {
    const body = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null || typeof body.clientId !== 'string' || !body.clientId) {
        return error(400, { message: 'Invalid body' });
    }
    return body as { clientId: string, [key: string]: unknown };
}

/** Claim the player for this client. 409 if another client already runs it. */
export async function POST({ request }) {
    const { clientId } = await readClientId(request);
    try {
        getSpotifyHelperInstance().claimHost(clientId);
    } catch (e) {
        return error(409, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}

/** Host heartbeat. Body: { clientId, deviceId? (player registered with Spotify), playback? (latest state or null) } */
export async function PUT({ request }) {
    const body = await readClientId(request);
    const spotify = getSpotifyHelperInstance();
    try {
        if (typeof body.deviceId === 'string') {
            await spotify.hostReady(body.clientId, body.deviceId);
        }
        const playback = body.playback;
        if (playback !== undefined && playback !== null && (typeof playback !== 'object'
            || typeof (playback as any).playing !== 'boolean'
            || typeof (playback as any).title !== 'string'
            || typeof (playback as any).artist !== 'string'
            || ((playback as any).contextUri !== null && typeof (playback as any).contextUri !== 'string'))) {
            return error(400, { message: 'Invalid playback' });
        }
        spotify.hostReport(body.clientId, { playback: playback as any });
    } catch (e) {
        return error(409, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}

/** Give the player up. */
export async function DELETE({ request }) {
    const { clientId } = await readClientId(request);
    getSpotifyHelperInstance().releaseHost(clientId);
    return new Response();
}
