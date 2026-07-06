import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

export async function POST({params}) {
    console.log("Deleting clock instance with id:", params.clockid);
    const manager = getBOTCTClockInstanceManager();
    manager.freeInstance(params.clockid);
    return new Response(null, { status: 200 });
}