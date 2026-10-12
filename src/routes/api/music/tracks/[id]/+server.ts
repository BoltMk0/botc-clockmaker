import { error, json } from '@sveltejs/kit';
import { isMusicTrackDetails } from '$lib/audio/common/musicLibrary';
import { deleteMusicTrack, updateMusicTrack } from '$lib/resources/server/musicLibrary';
import { libraryChange } from '../../musicApi';

/** Updates the track's details: { title, artist, album, year, trackNumber } (album by title, empty for none). */
export async function PATCH({ params, request }){
    const body = await request.json().catch(() => null);
    if(!isMusicTrackDetails(body)) return error(400, { message: 'Expected {title, artist, album} as text and {year, trackNumber} as whole numbers or null' });
    return json(await libraryChange(() => updateMusicTrack(params.id, body)));
}

/** Deletes the track and its file, and takes it out of every playlist. */
export async function DELETE({ params }){
    await libraryChange(() => deleteMusicTrack(params.id));
    return new Response(null, { status: 204 });
}
