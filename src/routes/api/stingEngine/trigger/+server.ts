import { getStingEngineHelperInstance } from '$lib/model/server/StingEngine/StingEngineHelper.js';

/** Fire the currently armed sting slot on every connected client. */
export async function POST() {
    getStingEngineHelperInstance().trigger();
    return new Response();
}
