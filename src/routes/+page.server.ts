import { listAmbienceResources } from "$lib/resources/server/ambience";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances();
    const ambienceResources = listAmbienceResources();
    return { instances, ambienceResources };
}
