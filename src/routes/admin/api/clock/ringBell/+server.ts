import { getBOTCTClockInstance } from "$lib/server/model";

export async function POST(){
    console.log("Bell ring requested via API.");
    const clock = getBOTCTClockInstance();
    clock.makeDaBellNoise();
    return new Response(null, {status: 200});
}