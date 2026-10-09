import { getBOTCTClockInstanceManager, InstanceNotFoundError } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions';
import { error } from '@sveltejs/kit';

// Where the back link goes instead of the game's town square, e.g. /play. Only same-site paths, so a shared link
// can't send people off to another site. (Browsers read "//x" and "/\x" as links to the site x.)
function backUrlFrom(url: URL): string | null {
    const backUrl = url.searchParams.get('backUrl');
    return backUrl && /^\/(?![/\\])/.test(backUrl) ? backUrl : null;
}

export async function load({params, url}){
    try {
        const model = getBOTCTClockInstanceManager().getInstance(params.clockid).model;
        return {
            model,
            teamName: model.config.teamName ?? model.clock.clockId,
            timerOptions: getTimerOptions(),
            backUrl: backUrlFrom(url)
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
