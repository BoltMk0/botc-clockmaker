import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ request, params}) {
    const data = await request.json();
    const { day, max } = data;
    const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
    if (typeof day === 'number') {
        clock.setDay(day, max ?? Math.max(10, day+1));
        return new Response('Day updated', { status: 200 });
    }
    return new Response('Invalid data', { status: 400 });
}