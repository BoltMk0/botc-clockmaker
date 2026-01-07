import { getBOTCTClockInstance } from '$lib/server/model';

export async function POST({ request }) {
    const data = await request.json();
    const { day, max } = data;
    const clock = getBOTCTClockInstance();
    if (typeof day === 'number' && typeof max === 'number') {
        clock.setDay(day, max);
        return new Response('Day updated', { status: 200 });
    }
    return new Response('Invalid data', { status: 400 });
}