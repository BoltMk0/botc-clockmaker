import { isTimeOfDay } from '$lib/model/client/types';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ request, params }) {
    const { timeOfDay } = await request.json();
    if (!isTimeOfDay(timeOfDay)) return new Response('Invalid time of day', { status: 400 });
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    // Day is the countdown running, so asking for it sets the timer up again, ready to start (morning until it is)
    if (timeOfDay === 'day') clock.resetDay();
    else {
        // Dusk or night ends a running countdown, so its bell doesn't ring later on
        if (timeOfDay !== 'morning' && clock.running) clock.endDay();
        clock.timeOfDay = timeOfDay;
    }
    return new Response('Time of day updated', { status: 200 });
}
