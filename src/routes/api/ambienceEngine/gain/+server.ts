import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { error } from '@sveltejs/kit';

export async function POST({request}){
    let value = parseFloat(await request.json());
    if(isNaN(value)){
        return error(400, {message: 'Invalid value - failed to parse'});
    }
    const engine = getAmbienceEngineHelperInstance();
    engine.gain = value;
    return new Response();
}