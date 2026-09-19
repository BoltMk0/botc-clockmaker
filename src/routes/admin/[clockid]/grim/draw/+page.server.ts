import { redirect } from '@sveltejs/kit';
import { get_draw_session_for_clock } from '$lib/resources/server/draw-sessions';
import { redactDrawSession } from '$lib/resources/common/drawSession';

export async function load({ params }) {
    const session = get_draw_session_for_clock(params.clockid);
    if (!session) {
        throw redirect(302, `/admin/${params.clockid}/grim/setup`);
    }
    return {
        clockid: params.clockid,
        session: redactDrawSession(session)
    };
}
