import { error, json } from '@sveltejs/kit';
import { isMusicAlbumDetails } from '$lib/audio/common/musicLibrary';
import { updateMusicAlbum } from '$lib/resources/server/musicLibrary';
import { libraryChange } from '../../musicApi';

/** Renames the album or changes its artist: { title, artist }. Returns the album its tracks are on (another, if merged). */
export async function PATCH({ params, request }){
    const body = await request.json().catch(() => null);
    if(!isMusicAlbumDetails(body)) return error(400, { message: 'Expected {title, artist}, both text' });
    return json(await libraryChange(() => updateMusicAlbum(params.id, body)));
}
