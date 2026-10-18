import { json } from '@sveltejs/kit';
import { get_draw_session_for_clock, set_draw_session_for_clock } from '$lib/resources/server/draw-sessions';
import { get_grimoire_state_history_resource_for_clock, set_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { seatDrawnPlayer } from '$lib/resources/server/draw-grimoire';

export async function POST({ params, request }) {
    const body = await request.json().catch(() => null);
    const number = body?.number;
    const playerName = body?.playerName;
    if (typeof number !== 'number') {
        return json({ error: 'number is required' }, { status: 400 });
    }
    if (typeof playerName !== 'string' || !playerName.trim()) {
        return json({ error: 'playerName is required' }, { status: 400 });
    }

    const session = get_draw_session_for_clock(params.clockid);
    if (!session) return json({ error: 'No draw session found' }, { status: 404 });

    const slot = session.slots.find(s => s.number === number);
    if (!slot) return json({ error: 'No such slot' }, { status: 404 });

    if (!slot.claimed) {
        slot.claimOrder = Math.max(0, ...session.slots.map(s => s.claimOrder ?? 0)) + 1;
    }
    slot.claimed = true;
    slot.playerName = playerName.trim();

    // Seat them on the grimoire straight away (or rename them, if they've confirmed before).
    const history = get_grimoire_state_history_resource_for_clock(params.clockid);
    if (history) {
        const token = slot.tokenId ? history.present.placedTokens.find(t => t.id === slot.tokenId) : undefined;
        if (token) {
            token.playerName = slot.playerName;
            history.present.timestamp = Date.now();
        } else if (!slot.tokenId) {
            seatDrawnPlayer(history, session, slot);
        }
        // (A token the storyteller has since taken off the grim stays off.)
        set_grimoire_state_history_resource_for_clock(params.clockid, history);
    }
    set_draw_session_for_clock(params.clockid, session);

    return json({ message: 'Player name confirmed' });
}
