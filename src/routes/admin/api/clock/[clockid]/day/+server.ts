import { getBOTCTClockInstanceManager } from '$lib/server/model';

export async function POST({ request, params}) {
    const data = await request.json();
    const { day, max } = data;
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    if (typeof day === 'number' && typeof max === 'number') {
        clock.setDay(day, max);
        return new Response('Day updated', { status: 200 });
    }
    return new Response('Invalid data', { status: 400 });
}