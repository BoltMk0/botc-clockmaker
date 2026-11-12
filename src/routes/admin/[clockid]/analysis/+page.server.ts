import { getBOTCTClockInstanceManager, InstanceNotFoundError } from '$lib/model/server/model';
import { backUrlFrom } from '$lib/common/backUrl';
import { error } from '@sveltejs/kit';

export async function load({params, url}){
    try {
        const model = getBOTCTClockInstanceManager().getInstance(params.clockid).model;
        return {
            model,
            teamName: model.config.teamName ?? model.clock.clockId,
            // Back to the remote this was opened from (standalone, or in the grimoire)
            backUrl: backUrlFrom(url) ?? `/admin/${params.clockid}/remote`
        }
    } catch (er) {
        if (er instanceof InstanceNotFoundError) {
            return error(404, `Clock instance with id ${params.clockid} not found`);
        }
        console.error(`Error loading clock instance with id ${params.clockid}:`, er);
        return error(500, `Error loading clock instance: ${er instanceof Error ? er.message : String(er)}`);
    }
}
