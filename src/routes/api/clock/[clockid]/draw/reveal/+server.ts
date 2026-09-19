import { json } from '@sveltejs/kit';
import { get_draw_session_for_clock } from '$lib/resources/server/draw-sessions';

export async function POST({ params, request }) {
    const body = await request.json().catch(() => null);
    const number = body?.number;
    if (typeof number !== 'number') {
        return json({ error: 'number is required' }, { status: 400 });
    }

    const session = get_draw_session_for_clock(params.clockid);
    if (!session) return json({ error: 'No draw session found' }, { status: 404 });

    const slot = session.slots.find(s => s.number === number);
    if (!slot) return json({ error: 'No such slot' }, { status: 404 });

    return json({ characterId: slot.characterId });
}
