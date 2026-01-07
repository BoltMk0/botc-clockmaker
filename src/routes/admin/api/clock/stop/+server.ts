import { getBOTCTClockInstance } from "$lib/server/model";

export async function POST() {
    console.log("Stopping clock...");
    const clock = getBOTCTClockInstance();
    clock.stop();
    return new Response('Clock stopped', { status: 200 });
}