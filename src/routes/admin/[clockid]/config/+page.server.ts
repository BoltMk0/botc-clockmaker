import { getBOTCTClockInstanceManager } from "$lib/server/model";
import { listResources } from "$lib/server/resources";
import type { Actions } from "./$types";

export async function load({ params }){
    const config = getBOTCTClockInstanceManager().getInstance(params.clockid).getConfig();
    const sfx_resources = listResources('sfx');
    return {config, sfx_resources};
}
