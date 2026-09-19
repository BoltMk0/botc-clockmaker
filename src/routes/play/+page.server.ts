import { getBOTCTClockInstanceManager } from "$lib/model/server/model";
import { get_grimoire_state_history_resource_for_clock } from "$lib/resources/server/grimoire-state";
import { getScriptById } from "$lib/resources/server/scripts";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances().map(instance => {
        const grim = get_grimoire_state_history_resource_for_clock(instance.clock.clockId);
        const scriptName = grim?.scriptId ? (getScriptById(grim.scriptId)?.name ?? null) : null;
        return { instance, scriptName };
    });
    return { games: instances };
}
