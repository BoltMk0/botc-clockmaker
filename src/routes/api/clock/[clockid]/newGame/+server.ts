import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

/** Starts the game over: dusk before the first night (day 0), with no timer. */
export async function POST({ params }) {
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    clock.newGame();
    return new Response(null, { status: 200 });
}
