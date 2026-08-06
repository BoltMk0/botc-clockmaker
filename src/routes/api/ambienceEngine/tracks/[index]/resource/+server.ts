import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { findResourceById } from '$lib/resources/server/resources.js';
import { error } from '@sveltejs/kit';

export async function POST({request, params}){
    let parsedIndex = parseInt(params.index);
    if(isNaN(parsedIndex)) return error(400, {message: 'Invalid index in url - failed to parse'});
    let value = String(await request.json());
    let res = findResourceById(value);
    if(res === null){
        return error(400, {message: 'No such resource'});
    }
    const engine = getAmbienceEngineHelperInstance();
    if(engine.tracks.length <= parsedIndex || parsedIndex < 0){
        return error(400, {message: 'Invalid track index - out of range'})
    }
    engine.tracks[parsedIndex].loadedResourceId = value;
    return new Response();
}

