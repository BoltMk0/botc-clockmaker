import { error, json } from '@sveltejs/kit';
import { createMusicPlaylist } from '$lib/resources/server/musicLibrary';

/** Creates an empty playlist: { name }. Returns it. */
export async function POST({ request }){
    const body = await request.json().catch(() => null);
    if(typeof body?.name !== 'string') return error(400, { message: 'Expected {name}' });
    return json(createMusicPlaylist(body.name), { status: 201 });
}
