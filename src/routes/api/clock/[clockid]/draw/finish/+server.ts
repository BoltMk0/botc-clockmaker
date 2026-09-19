import { json } from '@sveltejs/kit';
import { get_draw_session_for_clock, delete_draw_session_for_clock } from '$lib/resources/server/draw-sessions';
import { set_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { newGrimoireStateFromDraw } from '$lib/resources/common/grimoireState';
import { getCharactersForScript } from '$lib/resources/server/scripts';
import { alignmentForCategory } from '$lib/resources/common/gameData';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ params }) {
    const session = get_draw_session_for_clock(params.clockid);
    if (!session) return json({ error: 'No draw session found' }, { status: 404 });

    if (session.slots.some(s => !s.claimed)) {
        return json({ error: 'Not every slot has been claimed yet' }, { status: 400 });
    }

    const charactersById = new Map(getCharactersForScript(session.scriptId).map(c => [c.id, c]));
    const seats = session.slots.map(slot => ({
        characterId: slot.characterId,
        playerName: slot.playerName ?? String(slot.number),
        alignment: alignmentForCategory(charactersById.get(slot.characterId)?.category ?? 'townsfolk')
    }));

    const offSeats = (session.offSeatIds ?? []).map(characterId => ({
        characterId,
        alignment: alignmentForCategory(charactersById.get(characterId)?.category ?? 'townsfolk')
    }));

    const history = newGrimoireStateFromDraw(params.clockid, session.scriptId, seats, session.bluffIds, offSeats);
    set_grimoire_state_history_resource_for_clock(params.clockid, history);

    const playerCount = seats.reduce((sum, s) => sum + (charactersById.get(s.characterId)?.player_count ?? 0), 0);
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    if (clock) {
        clock.playerCount = playerCount;
        // End of the day with no time remaining; setup() may advance the day, so reset it after.
        clock.setup({ label: '', duration: 0, ringBellWhenRemaining: null });
        clock.day = 0;
    }

    delete_draw_session_for_clock(params.clockid);

    return json({ message: 'Draw finished, grimoire state created' });
}
