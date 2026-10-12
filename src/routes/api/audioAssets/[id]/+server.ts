import { error, json } from '@sveltejs/kit';
import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper';
import { getStingEngineHelperInstance } from '$lib/model/server/StingEngine/StingEngineHelper';
import { deleteResource, findResourceById, renameResource, ResourceNameTakenError } from '$lib/resources/server/resources';
import { isAudioAssetMetadata } from '$lib/audio/common/audioAssetMetadata';
import { moveAudioAssetMetadata, setAudioAssetMetadata } from '$lib/resources/server/audioAssetMetadata';

/** The audio asset libraries managed from the audio settings page, and the engine that plays each. */
const ENGINES = {
    ambience: getAmbienceEngineHelperInstance,
    sting: getStingEngineHelperInstance
} as const;

function resolve(id: string) {
    const resource = findResourceById(id);
    if(!resource || !(resource.type in ENGINES)) error(404, { message: 'Audio asset not found' });
    return { resource, engine: ENGINES[resource.type as keyof typeof ENGINES]() };
}

/**
 * Updates the asset: { name?, metadata? }. A name renames it, and the engine's tracks playing it (and its metadata)
 * move over to the new id; metadata ({title, artist, link, license}) replaces what's stored. Returns its (new) id.
 */
export async function PATCH({ params, request }){
    const { resource, engine } = resolve(params.id);
    const body = await request.json().catch(() => null);
    const hasName = typeof body?.name === 'string';
    const hasMetadata = body?.metadata !== undefined;
    if((!hasName && !hasMetadata) || (body?.name !== undefined && !hasName)) return error(400, { message: 'Expected {name?, metadata?}' });
    if(hasMetadata && !isAudioAssetMetadata(body.metadata)) return error(400, { message: 'Expected metadata to be {title, artist, link, license}, all text' });

    let id = resource.id;
    if(hasName){
        try {
            id = renameResource(resource, body.name);
        } catch(e) {
            return error(e instanceof ResourceNameTakenError ? 409 : 400, { message: e instanceof Error ? e.message : String(e) });
        }
        engine.replaceResource(resource.id, id);
        moveAudioAssetMetadata(resource.id, id);
    }
    if(hasMetadata) setAudioAssetMetadata(id, body.metadata);
    return json({ id });
}

/** Deletes the asset, and takes it out of any of the engine's tracks that had it loaded. */
export async function DELETE({ params }){
    const { resource, engine } = resolve(params.id);
    if(!deleteResource(resource)) return error(500, { message: 'Failed to delete audio asset' });
    engine.replaceResource(resource.id, null);
    moveAudioAssetMetadata(resource.id, null);
    return new Response(null, { status: 204 });
}
