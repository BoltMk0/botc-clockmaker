import { error, json } from '@sveltejs/kit';
import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper';
import { getStingEngineHelperInstance } from '$lib/model/server/StingEngine/StingEngineHelper';
import { deleteResource, findResourceById, renameResource, ResourceNameTakenError } from '$lib/resources/server/resources';

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

/** Renames the asset: { name }. Returns its new id; the engine's tracks playing it are moved over to that. */
export async function PATCH({ params, request }){
    const { resource, engine } = resolve(params.id);
    const body = await request.json().catch(() => null);
    if(typeof body?.name !== 'string') return error(400, { message: 'Expected {name}' });
    let newId: string;
    try {
        newId = renameResource(resource, body.name);
    } catch(e) {
        return error(e instanceof ResourceNameTakenError ? 409 : 400, { message: e instanceof Error ? e.message : String(e) });
    }
    engine.replaceResource(resource.id, newId);
    return json({ id: newId });
}

/** Deletes the asset, and takes it out of any of the engine's tracks that had it loaded. */
export async function DELETE({ params }){
    const { resource, engine } = resolve(params.id);
    if(!deleteResource(resource)) return error(500, { message: 'Failed to delete audio asset' });
    engine.replaceResource(resource.id, null);
    return new Response(null, { status: 204 });
}
