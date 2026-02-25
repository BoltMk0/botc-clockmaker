import { getBOTCTClockInstanceManager } from '$lib/server/model.js';

export async function load({ params }){
    return {
        clocks: getBOTCTClockInstanceManager().listInstances()
    }
}