import { v7 } from "uuid";
import { GRIM_STATE_MANAGER } from "./jsonResourceManager";
import { ensureTokenIds, isPlayerToken, type GrimoireStateHistory } from "../common/grimoireState";
import { getCharacterById } from "./characters";
import { getBOTCTClockInstanceManager, InstanceNotFoundError } from "$lib/model/server/model";

// Called with the new state each time a clock's grimoire is saved (null once it's deleted), and who saved it: the
// client id a grim page sent with its save, or null for the server itself (e.g. a player confirming their draw).
export type GrimoireStateListener = (history: GrimoireStateHistory | null, origin: string | null) => void;

const listeners = new Map<string, Set<GrimoireStateListener>>();

export function onGrimoireStateChanged(clockid: string, listener: GrimoireStateListener): () => void {
    if (!listeners.has(clockid)) listeners.set(clockid, new Set());
    listeners.get(clockid)!.add(listener);
    return () => {
        listeners.get(clockid)?.delete(listener);
        if (listeners.get(clockid)?.size === 0) listeners.delete(clockid);
    };
}

function notify(clockid: string, history: GrimoireStateHistory | null, origin: string | null) {
    for (const listener of [...(listeners.get(clockid) ?? [])]) {
        try {
            listener(history, origin);
        } catch (e) {
            console.error("Error notifying grimoire state listener:", e);
        }
    }
}

export function get_grimoire_state_history_resource_for_clock(clockid: string): GrimoireStateHistory | null {
    const history = GRIM_STATE_MANAGER.get(clockid);
    if (!history) {
        console.debug("No grimoire state history resource found for clock", clockid);
        return null;
    }
    ensureTokenIds(history);
    // Older saves have no revision; give them one so clients can tell whether they're up to date.
    if (!history.revision) history.revision = v7();
    return history;
}

// Saves a new state for the grimoire under a new revision, keeps the clock's player count in step with it and tells
// every open grim. Returns the new revision.
export function set_grimoire_state_history_resource_for_clock(clockid: string, history: GrimoireStateHistory, origin: string | null = null): string {
    history.revision = v7();
    GRIM_STATE_MANAGER.add(history);

    // The storyteller doesn't have to set the player count by hand as they seat players: every token carrying a
    // player name is a seated player, except travellers (who don't count towards the player count).
    const playerCount = history.present.placedTokens.filter(t => isPlayerToken(t) && (!t.characterId || !['traveler', 'loric', 'fabled'].includes(getCharacterById(t.characterId)?.category ?? ''))).length;
    try {
        getBOTCTClockInstanceManager().getInstance(clockid).playerCount = playerCount;
    } catch (e) {
        if (!(e instanceof InstanceNotFoundError)) throw e;
    }

    notify(clockid, history, origin);
    return history.revision;
}

export function delete_grimoire_state_history_resource_for_clock(clockid: string) {
    GRIM_STATE_MANAGER.delete(clockid);
    notify(clockid, null, null);
}
