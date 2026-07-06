import { getBOTCTClockInstanceManager } from "$lib/model/server/model";

export async function GET(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances();
    return new Response(JSON.stringify({ instances }), {
        headers: { "Content-Type": "application/json" }
    });
}
