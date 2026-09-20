import { getAmbienceEngineHelperInstance } from "$lib/model/server/AmbienceEngine/AmbienceEngineHelper";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model";
import { listAmbienceResources } from "$lib/resources/server/ambience-resources";
import { getSpotifyPresets } from "$lib/resources/server/spotifyPresets";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances();
    const ambienceResources = listAmbienceResources();
    const ambienceEngineModel = getAmbienceEngineHelperInstance().model
    const spotifyPresets = getSpotifyPresets();
    return {instances, ambienceResources, ambienceEngineModel, spotifyPresets};
}