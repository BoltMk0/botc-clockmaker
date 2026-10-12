import { error, json } from '@sveltejs/kit';
import { createUniqueResource } from '$lib/resources/server/resources';
import { moveAudioAssetMetadata, setAudioAssetMetadata } from '$lib/resources/server/audioAssetMetadata';
import { emptyAudioAssetMetadata } from '$lib/audio/common/audioAssetMetadata';

const UPLOADABLE_TYPES = ['ambience', 'sting'] as const;

/**
 * Uploads a new asset, as multipart form data: `type` ('ambience' | 'sting') and `file`. Named after the file; an
 * ambience asset also gets the filename (without its extension) as its metadata title.
 */
export async function POST({ request }){
    const formData = await request.formData();
    const type = formData.get('type');
    const file = formData.get('file');
    if(!UPLOADABLE_TYPES.includes(type as any)) return error(400, { message: `Expected type to be one of: ${UPLOADABLE_TYPES.join(', ')}` });
    if(!(file instanceof File) || file.size === 0) return error(400, { message: 'Expected a non-empty "file"' });
    try {
        const id = createUniqueResource(type as typeof UPLOADABLE_TYPES[number], file.name, Buffer.from(await file.arrayBuffer()));
        // A file deleted some other way may have left metadata under this id; it belongs to that file, not this one.
        moveAudioAssetMetadata(id, null);
        if(type === 'ambience'){
            const dot = file.name.lastIndexOf('.');
            const title = (dot > 0 ? file.name.slice(0, dot) : file.name).trim();
            setAudioAssetMetadata(id, { ...emptyAudioAssetMetadata(), title });
        }
        return json({ id }, { status: 201 });
    } catch(e) {
        return error(415, { message: e instanceof Error ? e.message : String(e) });
    }
}
