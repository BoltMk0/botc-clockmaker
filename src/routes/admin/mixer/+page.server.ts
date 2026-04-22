import { listAmbienceResources } from "$lib/resources/server/ambience";
import { getBOTCTClockInstanceManager } from "$lib/server/model";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances();

    const ambienceResources = await listAmbienceResources();
    return {instances, ambienceResources};
}