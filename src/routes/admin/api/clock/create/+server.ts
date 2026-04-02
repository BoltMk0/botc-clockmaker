import { getBOTCTClockInstanceManager } from "$lib/server/model";

export async function POST(){
    const manager = getBOTCTClockInstanceManager();
    const { id } = manager.newInstance();
    return new Response(id, {
        headers: { "Content-Type": "text/plain" }
    });
}