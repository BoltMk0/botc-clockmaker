import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { error } from '@sveltejs/kit';

/** Patch one track: { gain?, pan?, activeInDay?, activeAtNight?, loadedResourceId? } */
export async function POST({request, params}){
    const index = parseInt(params.index);
    if(isNaN(index)) return error(400, {message: 'Invalid index in url - failed to parse'});
    const patch = await request.json().catch(()=>null);
    if(typeof patch !== 'object' || patch === null) return error(400, {message: 'Invalid body'});
    try {
        getAmbienceEngineHelperInstance().updateTrack(index, patch);
    } catch (e) {
        return error(400, {message: e instanceof Error ? e.message : String(e)});
    }
    return new Response();
}
