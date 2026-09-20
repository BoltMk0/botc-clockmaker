import { json } from '@sveltejs/kit';
import { newDrawSession, get_draw_session_for_clock, delete_draw_session_for_clock } from '$lib/resources/server/draw-sessions';
import { redactDrawSession } from '$lib/resources/common/drawSession';

export async function GET({ params }) {
    const session = get_draw_session_for_clock(params.clockid);
    if (!session) return json({ error: 'No draw session found' }, { status: 404 });
    return json(redactDrawSession(session));
}

export async function POST({ params, request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { scriptId, characterIds, bluffIds, offSeatIds = [], presetId = null } = body;
    if (typeof scriptId !== 'string' || !scriptId) {
        return json({ error: 'scriptId is required' }, { status: 400 });
    }
    if (!Array.isArray(characterIds) || characterIds.length === 0 || !characterIds.every((id: any) => typeof id === 'string')) {
        return json({ error: 'characterIds must be a non-empty array of strings' }, { status: 400 });
    }
    if (!Array.isArray(bluffIds) || !bluffIds.every((id: any) => typeof id === 'string')) {
        return json({ error: 'bluffIds must be an array of strings' }, { status: 400 });
    }

    if (!Array.isArray(offSeatIds) || !offSeatIds.every((id: any) => typeof id === 'string')) {
        return json({ error: 'offSeatIds must be an array of strings' }, { status: 400 });
    }

    if (presetId !== null && typeof presetId !== 'string') {
        return json({ error: 'presetId must be a string' }, { status: 400 });
    }

    const session = newDrawSession(params.clockid, scriptId, characterIds, bluffIds, offSeatIds, presetId);
    return json(redactDrawSession(session), { status: 201 });
}

export async function DELETE({ params }) {
    delete_draw_session_for_clock(params.clockid);
    return json({ message: 'Draw session deleted successfully' });
}
