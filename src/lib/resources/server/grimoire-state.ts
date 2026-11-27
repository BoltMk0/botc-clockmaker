import { v7 } from "uuid";
import { GRIM_STATE_MANAGER } from "./jsonResourceManager";
import { ensureTokenIds, isPlayerToken, newGrimoireStateHistory, tokensToSeat, type GrimoireStateHistory, type PlacedToken } from "../common/grimoireState";
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

// The clock's grimoire, or a new empty one with no script if it has none yet (the grim is always there for a game,
// whether or not it's been set up). A new one is stored straight away, but without touching the clock's player count
// or telling anyone, as nothing has changed yet.
export function get_or_create_grimoire_state_history_resource_for_clock(clockid: string): GrimoireStateHistory {
    const existing = get_grimoire_state_history_resource_for_clock(clockid);
    if (existing) return existing;
    const history = newGrimoireStateHistory(clockid);
    history.revision = v7();
    GRIM_STATE_MANAGER.add(history);
    return history;
}

// Saves a new state for the grimoire under a new revision, keeps the clock's player count in step with it and tells
// every open grim. Returns the new revision.
export function set_grimoire_state_history_resource_for_clock(clockid: string, history: GrimoireStateHistory, origin: string | null = null): string {
    history.revision = v7();
    GRIM_STATE_MANAGER.add(history);

    // The storyteller doesn't have to set the player count by hand as they seat players: the seated tokens (the named
    // ones, or every token while none are named; never loric or fabled) are the players, less the tokens that never go
    // in the bag (e.g. the Drunk, sat apart while the players are unnamed) unless a player's name is on them, and less
    // the travellers (who don't count towards the player count).
    const categoryOf = (t: PlacedToken) => t.characterId ? getCharacterById(t.characterId)?.category : undefined;
    const playerCount = tokensToSeat(history.present.placedTokens, t => ['loric', 'fabled'].includes(categoryOf(t) ?? ''))
        .filter(t => isPlayerToken(t) || (t.characterId ? getCharacterById(t.characterId)?.allowedInBag : undefined) !== false)
        .filter(t => categoryOf(t) !== 'traveler').length;
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
