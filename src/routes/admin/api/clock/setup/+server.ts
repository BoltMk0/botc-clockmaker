import { getBOTCTClockInstance } from '$lib/server/model';

export async function POST({ request }) {
    console.log("HEY");
    const data = await request.json();
    const duration: number = data.duration;
    const ringBellAfter: number|null = data.ringBellAfter;
    const clock = getBOTCTClockInstance();
    clock.setup(duration, {ringBellAfter});
    return new Response(null, { status: 200 });
}