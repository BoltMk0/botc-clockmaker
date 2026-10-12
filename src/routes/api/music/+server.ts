import { json } from '@sveltejs/kit';
import { getMusicLibrary } from '$lib/resources/server/musicLibrary';

/** The whole music library: { tracks, albums, playlists }. */
export async function GET(){
    return json(getMusicLibrary());
}
