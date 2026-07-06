import { listResources } from '$lib/resources/server/resources.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model.js';

export async function load({ params }){
    return {
        clocks: getBOTCTClockInstanceManager().listInstances(),
        sfxResources: listResources('sfx')
    }
}