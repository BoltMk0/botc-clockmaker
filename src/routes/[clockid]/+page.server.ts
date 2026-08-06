import { getBOTCTClockInstanceManager, InstanceNotFoundError } from '$lib/model/server/model';
import { listAmbienceResources } from '$lib/resources/server/ambience-resources';
import { error } from '@sveltejs/kit';


export async function load({params}){
    try {
        const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
        const clientIds = getBOTCTClockInstanceManager().listInstances().map(instance => ({id: instance.clock.clockId, name: instance.config.teamName ?? instance.clock.clockId}));
        const ambienceResources = listAmbienceResources();
        return {
            model: clock.model,
            clientIds,
            ambienceResources
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