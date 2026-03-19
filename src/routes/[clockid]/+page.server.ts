import { getBOTCTClockInstanceManager } from '$lib/server/model';

export async function load({params}){
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    const clientIds = getBOTCTClockInstanceManager().listInstances().map(instance => ({id: instance.id, name: instance.config.teamName ?? instance.id}));
    return {
        config: clock.getConfig(),
        clientIds
    }
}