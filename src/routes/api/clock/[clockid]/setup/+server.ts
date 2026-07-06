import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({ request, params }) {
    const data = await request.json();
    const duration: number = data.duration;
    const ringBellAfter: number|null = data.ringBellAfter;
    const manager = getBOTCTClockInstanceManager();
    const clock = manager.getInstance(params.clockid);
    clock.setup(duration, {ringBellAfter});
    return new Response(null, { status: 200 });
}