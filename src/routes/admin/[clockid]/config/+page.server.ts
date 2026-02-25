import { getBOTCTClockInstanceManager } from "$lib/server/model";
import type { Actions } from "./$types";

export async function load({ params }){
    const config = getBOTCTClockInstanceManager().getInstance(params.clockid).getConfig();
    return {config};
}
