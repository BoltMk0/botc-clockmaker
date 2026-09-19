import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { isGrimoireStateHistory, type GrimoireStateHistory } from '$lib/resources/common/grimoireState';
import { getScriptWithCharacters } from '$lib/resources/server/scripts';

export async function load({ params }) {
    const clockid = params.clockid;

    const rawGrimoireState = get_grimoire_state_history_resource_for_clock(clockid) as GrimoireStateHistory | null;
    const grimoireState = isGrimoireStateHistory(rawGrimoireState) ? rawGrimoireState : null;

    const script = grimoireState?.scriptId ? getScriptWithCharacters(grimoireState.scriptId) : null;

    return {
        clockid,
        grimoireState,
        script,
    };
}
