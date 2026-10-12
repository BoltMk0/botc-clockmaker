import { error, json } from '@sveltejs/kit';
import { addMusicTrack } from '$lib/resources/server/musicLibrary';
import { libraryChange } from '../musicApi';

/**
 * Uploads a new track, as multipart form data with a `file` field. Its details (and its album's artwork, if the album
 * has none yet) are read from the file's tags where it has them. Returns the track.
 */
export async function POST({ request }){
    const file = (await request.formData()).get('file');
    if(!(file instanceof File) || file.size === 0) return error(400, { message: 'Expected a non-empty "file"' });
    const data = Buffer.from(await file.arrayBuffer());
    return json(await libraryChange(() => addMusicTrack(file.name, data)), { status: 201 });
}
