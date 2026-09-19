import { getDefaultTimerOptions } from '$lib/common/timerOption.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';
import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state.js';

export async function load({params}){
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    const clientIds = getBOTCTClockInstanceManager().listInstances().map(instance => ({id: instance.clock.clockId, name: instance.config.teamName ?? instance.clock.clockId}));
    const timerOptions = getTimerOptions();
    const hasGrim = get_grimoire_state_history_resource_for_clock(params.clockid) !== null;
    return {
        model: clock.model,
        clientIds,
        timerOptions,
        hasGrim
    }
}