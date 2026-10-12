import { error, json } from '@sveltejs/kit';
import { deleteMusicPlaylist, updateMusicPlaylist } from '$lib/resources/server/musicLibrary';
import { libraryChange } from '../../musicApi';

/** Renames the playlist and/or sets its tracks, in order: { name?, trackIds? }. Returns it. */
export async function PATCH({ params, request }){
    const body = await request.json().catch(() => null);
    const nameOk = body?.name === undefined || typeof body.name === 'string';
    const trackIdsOk = body?.trackIds === undefined || (Array.isArray(body.trackIds) && body.trackIds.every((t: unknown) => typeof t === 'string'));
    if(typeof body !== 'object' || body === null || !nameOk || !trackIdsOk) return error(400, { message: 'Expected {name?, trackIds?}' });
    return json(await libraryChange(() => updateMusicPlaylist(params.id, { name: body.name, trackIds: body.trackIds })));
}

export async function DELETE({ params }){
    await libraryChange(() => deleteMusicPlaylist(params.id));
    return new Response(null, { status: 204 });
}
