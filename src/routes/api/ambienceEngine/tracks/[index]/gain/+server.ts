import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { error } from '@sveltejs/kit';

export async function POST({request, params}){
    let parsedIndex = parseInt(params.index);
    if(isNaN(parsedIndex)) return error(400, {message: 'Invalid index in url - failed to parse'});
    let value = parseFloat(await request.json());
    if(isNaN(value)){
        return error(400, {message: 'Invalid value - failed to parse'});
    }
    const engine = getAmbienceEngineHelperInstance();
    if(engine.tracks.length <= parsedIndex || parsedIndex < 0){
        return error(400, {message: 'Invalid track index - out of range'})
    }
    engine.tracks[parsedIndex].gain = value;
    return new Response();
}