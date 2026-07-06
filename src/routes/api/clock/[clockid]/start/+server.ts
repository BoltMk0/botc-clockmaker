import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({params}) {
    const manager = getBOTCTClockInstanceManager();
    const clock = manager.getInstance(params.clockid);
    clock.start();
    return new Response(null, { status: 200 });
}