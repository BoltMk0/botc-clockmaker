import { getBOTCTClockInstanceManager, InstanceNotFoundError } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions';
import { error } from '@sveltejs/kit';

export async function load({params}){
    try {
        const model = getBOTCTClockInstanceManager().getInstance(params.clockid).model;
        return {
            model,
            teamName: model.config.teamName ?? model.clock.clockId,
            timerOptions: getTimerOptions()
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
