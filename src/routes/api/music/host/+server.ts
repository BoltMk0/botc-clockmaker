import { getMusicHelperInstance } from '$lib/model/server/Music/MusicHelper';
import { error } from '@sveltejs/kit';
import { MUSIC_HOST_EVENTS, type MusicHostEvent } from '$lib/audio/common/model/musicModel';

async function readClientId(request: Request) {
    const body = await request.json().catch(() => null);
    if (typeof body !== 'object' || body === null || typeof body.clientId !== 'string' || !body.clientId) {
        return error(400, { message: 'Invalid body' });
    }
    return body as { clientId: string, [key: string]: unknown };
}

/** Claim the music player for this client. 409 if another client already runs it (or the Spotify player is running). */
export async function POST({ request }) {
    const { clientId } = await readClientId(request);
    try {
        getMusicHelperInstance().claimHost(clientId);
    } catch (e) {
        return error(409, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}

/** Host heartbeat. Body: { clientId, event?: 'ended' | 'error' | 'crossfade', loadId? (the track the event is about) } */
export async function PUT({ request }) {
    const body = await readClientId(request);
    const event = body.event as MusicHostEvent | undefined;
    if (event !== undefined && !MUSIC_HOST_EVENTS.includes(event)) return error(400, { message: 'Invalid event' });
    if (event !== undefined && typeof body.loadId !== 'number') return error(400, { message: 'Expected the loadId of the track' });
    try {
        getMusicHelperInstance().hostReport(body.clientId, { event, loadId: body.loadId as number | undefined });
    } catch (e) {
        return error(409, { message: e instanceof Error ? e.message : String(e) });
    }
    return new Response();
}

/** Give the player up. */
export async function DELETE({ request }) {
    const { clientId } = await readClientId(request);
    getMusicHelperInstance().releaseHost(clientId);
    return new Response();
}
