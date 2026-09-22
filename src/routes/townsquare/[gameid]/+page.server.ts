import { getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper';
import { getStingEngineHelperInstance } from '$lib/model/server/StingEngine/StingEngineHelper';
import { getBOTCTClockInstanceManager, InstanceNotFoundError } from '$lib/model/server/model';
import { listAmbienceResources } from '$lib/resources/server/ambience-resources';
import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { getSpotifyPresets } from '$lib/resources/server/spotifyPresets';
import { error } from '@sveltejs/kit';


export async function load({params}){
    try {
        const clock = getBOTCTClockInstanceManager().getInstance(params.gameid);
        const clientIds = getBOTCTClockInstanceManager().listInstances().map(instance => ({id: instance.clock.clockId, name: instance.config.teamName ?? instance.clock.clockId}));
        const ambienceResources = listAmbienceResources();
        const ambienceEngineModel = getAmbienceEngineHelperInstance().model;
        const stingEngineModel = getStingEngineHelperInstance().model;
        const spotifyPresets = getSpotifyPresets();
        const hasGrim = get_grimoire_state_history_resource_for_clock(params.gameid) !== null;
        return {
            model: clock.model,
            clientIds,
            ambienceResources,
            ambienceEngineModel,
            stingEngineModel,
            spotifyPresets,
            hasGrim
        }
    } catch (er) {
        if (er instanceof InstanceNotFoundError) {
            return error(404, `Clock instance with id ${params.gameid} not found`);
        } else {
            console.error(`Error loading clock instance with id ${params.gameid}:`, er);
            return error(500, `Error loading clock instance: ${er instanceof Error ? er.message : String(er)}`);
        }
    }
}