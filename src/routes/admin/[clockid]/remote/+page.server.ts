import { getBOTCTClockInstanceManager, InstanceNotFoundError } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions';
import { getMusicPresets } from '$lib/resources/server/musicPresets';
import { getSpotifyPresets } from '$lib/resources/server/spotifyPresets';
import { error } from '@sveltejs/kit';
import { backUrlFrom } from '$lib/common/backUrl';

export async function load({params, url}){
    try {
        const model = getBOTCTClockInstanceManager().getInstance(params.clockid).model;
        return {
            model,
            teamName: model.config.teamName ?? model.clock.clockId,
            timerOptions: getTimerOptions(),
            backUrl: backUrlFrom(url),
            musicPresets: getMusicPresets(),
            spotifyPresets: getSpotifyPresets()
        }
    } catch (er) {
        if (er instanceof InstanceNotFoundError) {
            return error(404, `Clock instance with id ${params.clockid} not found`);
        } else {
            console.error(`Error loading clock instance with id ${params.clockid}:`, er);
            return error(500, `Error loading clock instance: ${er instanceof Error ? er.message : String(er)}`);
        }
    }
}
