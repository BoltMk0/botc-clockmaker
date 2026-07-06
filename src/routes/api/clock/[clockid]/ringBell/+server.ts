import { getBOTCTClockInstanceManager } from "$lib/model/server/model";

export async function POST({params}){
    console.log("Bell ring requested via API.");
    const manager = getBOTCTClockInstanceManager();
    const clock = manager.getInstance(params.clockid);
    clock.makeDaBellNoise();
    return new Response(null, {status: 200});
}