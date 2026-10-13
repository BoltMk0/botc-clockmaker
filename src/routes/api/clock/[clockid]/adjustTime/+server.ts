import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

/** The most a single adjustment can add or take off, in seconds. */
const MAX_ADJUST_SECONDS = 60 * 60;

export async function POST({ request, params }) {
    const { seconds } = await request.json();
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || Math.abs(seconds) > MAX_ADJUST_SECONDS) {
        return new Response('Invalid seconds', { status: 400 });
    }
    getBOTCTClockInstanceManager().getInstance(params.clockid).adjustTime(seconds);
    return new Response('Time adjusted', { status: 200 });
}
