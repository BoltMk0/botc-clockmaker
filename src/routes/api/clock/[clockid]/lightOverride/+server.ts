import { isLightOverride } from '$lib/model/common/ClocktowerClockModel';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

/** Overrides the lights (with Lightscapes) as `override`, or with null, ends it: the lights go back to following the game. */
export async function POST({ request, params }) {
    const { override } = await request.json();
    if (override !== null && !isLightOverride(override)) return new Response('Invalid light override', { status: 400 });
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    clock.lightOverride = override ?? undefined;
    return new Response(null, { status: 204 });
}
