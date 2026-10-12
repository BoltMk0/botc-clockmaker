import { error, json } from '@sveltejs/kit';
import { isMusicTrackDetails } from '$lib/audio/common/musicLibrary';
import { deleteMusicTrack, updateMusicTrack } from '$lib/resources/server/musicLibrary';
import { musicLoudnessEvents } from '$lib/resources/server/musicLoudness';
import { libraryChange } from '../../musicApi';

/**
 * Updates the track's details: { title, artist, album, year, trackNumber, loudness? } (album by title, empty for none;
 * loudness in LUFS or null, unchanged if left out).
 */
export async function PATCH({ params, request }){
    const body = await request.json().catch(() => null);
    if(!isMusicTrackDetails(body)) return error(400, { message: 'Expected {title, artist, album} as text, {year, trackNumber} as whole numbers or null, and loudness as LUFS or null' });
    const track = await libraryChange(() => updateMusicTrack(params.id, body));
    if(body.loudness !== undefined) musicLoudnessEvents.emit('changed', track.id, track.loudness ?? null);
    return json(track);
}

/** Deletes the track and its file, and takes it out of every playlist. */
export async function DELETE({ params }){
    await libraryChange(() => deleteMusicTrack(params.id));
    return new Response(null, { status: 204 });
}
