import { isTimeOfDay } from '$lib/model/client/types';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ request, params }) {
    const { timeOfDay } = await request.json();
    if (!isTimeOfDay(timeOfDay)) return new Response('Invalid time of day', { status: 400 });
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    // Day is the countdown running, so asking for it (or the morning) sets the timer up again, ready to start (morning
    // until it is): the next day, coming from dusk or night
    if (timeOfDay === 'day' || timeOfDay === 'morning') clock.resetDay();
    else {
        // Dusk or night ends a running countdown (ringing the end of day bell now, if it hadn't run out), so it doesn't ring later on
        if (clock.running) clock.endDay(timeOfDay);
        else clock.timeOfDay = timeOfDay;
    }
    return new Response('Time of day updated', { status: 200 });
}
