import { getAmbienceEngineHelperInstance } from "$lib/model/server/AmbienceEngine/AmbienceEngineHelper";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model";
import { listAmbienceResources } from "$lib/resources/server/ambience-resources";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances();
    const ambienceResources = listAmbienceResources();
    const ambienceEngineModel = getAmbienceEngineHelperInstance().model
    return {instances, ambienceResources, ambienceEngineModel};
}