import { getBOTCTClockInstanceManager } from "$lib/model/server/model";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    return { instances: manager.listInstances() };
}
