import { getBOTCTClockInstance } from '$lib/server/model';

export async function POST() {
    const clock = getBOTCTClockInstance();
    clock.start();
    return new Response(null, { status: 200 });
}