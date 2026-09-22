import { getAmbienceEngineHelperInstance } from "$lib/model/server/AmbienceEngine/AmbienceEngineHelper";
import { getStingEngineHelperInstance } from "$lib/model/server/StingEngine/StingEngineHelper";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model";
import { listAmbienceResources } from "$lib/resources/server/ambience-resources";
import { getSpotifyPresets } from "$lib/resources/server/spotifyPresets";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances();
    const ambienceResources = listAmbienceResources();
    const ambienceEngineModel = getAmbienceEngineHelperInstance().model
    const stingEngineModel = getStingEngineHelperInstance().model
    const spotifyPresets = getSpotifyPresets();
    return {instances, ambienceResources, ambienceEngineModel, stingEngineModel, spotifyPresets};
}