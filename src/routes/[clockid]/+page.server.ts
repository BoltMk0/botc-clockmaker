import { getBOTCTClockInstanceManager } from '$lib/server/model';

export async function load({params}){
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    return {
        config: clock.getConfig()
    }
}