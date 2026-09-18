import { GRIM_STATE_MANAGER } from "./jsonResourceManager";
import type { GrimoireStateHistory } from "../../../routes/admin/games/[id]/grimoire/types";

export function get_grimoire_state_history_resource_for_game(gameid: string): GrimoireStateHistory | null {
    const history = GRIM_STATE_MANAGER.get(gameid);
    if (!history) {
        console.debug("No grimoire state history resource found for game", gameid);
        return null;
    }
    console.debug("Grimoire state history resource found for game", gameid);
    return history;
}

export function set_grimoire_state_history_resource_for_game(gameid: string, history: GrimoireStateHistory) {
    GRIM_STATE_MANAGER.add(history);
}

export function delete_grimoire_state_history_resource_for_game(gameid: string) {
    GRIM_STATE_MANAGER.delete(gameid);
}
