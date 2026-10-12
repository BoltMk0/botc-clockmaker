import { isTimeOfDay } from '$lib/model/client/types';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ request, params }) {
    const { timeOfDay } = await request.json();
    if (!isTimeOfDay(timeOfDay)) return new Response('Invalid time of day', { status: 400 });
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    clock.timeOfDay = timeOfDay;
    return new Response('Time of day updated', { status: 200 });
}
