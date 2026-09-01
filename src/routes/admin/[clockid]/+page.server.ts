import { getDefaultTimerOptions } from '$lib/common/timerOption.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';

export async function load({params}){
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    const clientIds = getBOTCTClockInstanceManager().listInstances().map(instance => ({id: instance.clock.clockId, name: instance.config.teamName ?? instance.clock.clockId}));
    const timerOptions = getTimerOptions();
    return {
        model: clock.model,
        clientIds,
        timerOptions
    }
}