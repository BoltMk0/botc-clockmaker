import { json } from '@sveltejs/kit';
import { get_draw_session_for_clock, delete_draw_session_for_clock } from '$lib/resources/server/draw-sessions';
import { get_grimoire_state_history_resource_for_clock, set_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { newGrimoireForDrawSession, seatDrawnPlayer } from '$lib/resources/server/draw-grimoire';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ params }) {
    const session = get_draw_session_for_clock(params.clockid);
    if (!session) return json({ error: 'No draw session found' }, { status: 404 });

    if (session.slots.some(s => !s.claimed)) {
        return json({ error: 'Not every slot has been claimed yet' }, { status: 400 });
    }

    // Each player was seated on the grimoire as they confirmed. Only a draw from before that (or one whose grimoire
    // was deleted part way) still has players to seat.
    let history = get_grimoire_state_history_resource_for_clock(params.clockid);
    if (!history) {
        history = newGrimoireForDrawSession(params.clockid, session);
        for (const slot of session.slots) slot.tokenId = null;
    }
    const unseated = session.slots.filter(s => !s.tokenId);
    if (unseated.length > 0) {
        // Seat order is the order players took their tokens, not the (shuffled) slot numbers.
        const bySeatOrder = [...unseated].sort((a, b) => (a.claimOrder ?? Infinity) - (b.claimOrder ?? Infinity) || a.number - b.number);
        for (const slot of bySeatOrder) seatDrawnPlayer(history, session, slot);
        set_grimoire_state_history_resource_for_clock(params.clockid, history);
    }

    // Dusk before the first night, so going to the morning starts day 1
    try {
        getBOTCTClockInstanceManager().getInstance(params.clockid).newGame();
    } catch (e) {
        console.error("Couldn't start a new game on the clock after the draw:", e);
    }

    delete_draw_session_for_clock(params.clockid);

    return json({ message: 'Draw finished' });
}
