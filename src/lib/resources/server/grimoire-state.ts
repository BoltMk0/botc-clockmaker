import { GRIM_STATE_MANAGER } from "./jsonResourceManager";
import type { GrimoireStateHistory } from "../common/grimoireState";

export function get_grimoire_state_history_resource_for_clock(clockid: string): GrimoireStateHistory | null {
    const history = GRIM_STATE_MANAGER.get(clockid);
    if (!history) {
        console.debug("No grimoire state history resource found for clock", clockid);
        return null;
    }
    console.debug("Grimoire state history resource found for clock", clockid);
    return history;
}

export function set_grimoire_state_history_resource_for_clock(clockid: string, history: GrimoireStateHistory) {
    GRIM_STATE_MANAGER.add(history);
}

export function delete_grimoire_state_history_resource_for_clock(clockid: string) {
    GRIM_STATE_MANAGER.delete(clockid);
}
