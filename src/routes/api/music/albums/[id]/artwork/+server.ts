import { error, json } from '@sveltejs/kit';
import { clearMusicAlbumArtwork, setMusicAlbumArtwork } from '$lib/resources/server/musicLibrary';
import { libraryChange } from '../../../musicApi';

/** Replaces the album's artwork, as multipart form data with a `file` field (an image). Returns the album. */
export async function PUT({ params, request }){
    const file = (await request.formData()).get('file');
    if(!(file instanceof File) || file.size === 0) return error(400, { message: 'Expected a non-empty "file"' });
    const data = Buffer.from(await file.arrayBuffer());
    return json(await libraryChange(() => setMusicAlbumArtwork(params.id, data)));
}

export async function DELETE({ params }){
    return json(await libraryChange(() => clearMusicAlbumArtwork(params.id)));
}
