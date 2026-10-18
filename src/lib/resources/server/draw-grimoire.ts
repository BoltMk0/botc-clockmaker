import { addDrawnSeatToken, newGrimoireStateForDraw, type Alignment, type GrimoireStateHistory } from "../common/grimoireState";
import { drawSessionBluffSets, type DrawSession, type DrawSlot } from "../common/drawSession";
import { alignmentForCategory } from "../common/gameData";
import { getCharactersForScript } from "./scripts";

// The grimoire is built as the draw goes: it's made when the draw starts, with the tokens sorted onto the grim, and
// each player's token is added the moment they confirm their name.

function alignmentLookup(scriptId: string): (characterId: string) => Alignment {
    const charactersById = new Map(getCharactersForScript(scriptId).map(c => [c.id, c]));
    return characterId => alignmentForCategory(charactersById.get(characterId)?.category ?? 'townsfolk');
}

export function newGrimoireForDrawSession(clockid: string, session: DrawSession): GrimoireStateHistory {
    const alignmentOf = alignmentLookup(session.scriptId);
    const offSeats = (session.offSeatIds ?? []).map(characterId => ({ characterId, alignment: alignmentOf(characterId) }));
    return newGrimoireStateForDraw(clockid, session.scriptId, session.slots.map(s => s.characterId), drawSessionBluffSets(session), offSeats, session.presetId ?? null);
}

// Puts a claimed slot's player on the grimoire, in their seat by the order they drew, and records their token on the slot.
export function seatDrawnPlayer(history: GrimoireStateHistory, session: DrawSession, slot: DrawSlot) {
    const alignmentOf = alignmentLookup(session.scriptId);
    slot.tokenId = addDrawnSeatToken(
        history,
        { characterId: slot.characterId, playerName: slot.playerName ?? '', alignment: alignmentOf(slot.characterId) },
        (slot.claimOrder ?? 1) - 1,
        session.slots.length
    );
}
