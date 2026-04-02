import { getBOTCTClockInstanceManager } from "$lib/server/model";
import { resourceManager } from "$lib/server/resourceManager.js";
import type { Actions } from "./$types";

export async function load({ params }){
    const config = getBOTCTClockInstanceManager().getInstance(params.clockid).getConfig();
    const resources = resourceManager.listResources();
    return {config, resources};
}
