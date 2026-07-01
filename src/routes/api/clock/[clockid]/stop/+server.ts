import { getBOTCTClockInstanceManager } from "$lib/server/model";

export async function POST({params}) {
    console.log("Stopping clock...");
    const manager = getBOTCTClockInstanceManager();
    const clock = manager.getInstance(params.clockid);
    clock.stop();
    return new Response('Clock stopped', { status: 200 });
}