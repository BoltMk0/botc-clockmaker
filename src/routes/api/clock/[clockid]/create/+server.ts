import { getBOTCTClockInstanceManager } from '$lib/server/model';

export async function POST({params}) {
    console.log("Creating clock...");
    const manager = getBOTCTClockInstanceManager();
    manager.newInstance(params.clockid);
    return new Response('Clock created', { status: 200 });
}
