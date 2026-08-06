import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function load({params}){
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    const clientIds = getBOTCTClockInstanceManager().listInstances().map(instance => ({id: instance.clock.clockId, name: instance.config.teamName ?? instance.clock.clockId}));
    return {
        model: clock.model,
        clientIds
    }
}