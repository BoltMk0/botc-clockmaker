import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { error } from '@sveltejs/kit';

/** Append a new empty track. */
export async function POST(){
    try {
        getAmbienceEngineHelperInstance().addTrack();
    } catch (e) {
        return error(400, {message: e instanceof Error ? e.message : String(e)});
    }
    return new Response();
}
