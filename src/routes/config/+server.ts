import { getBOTCTClockInstance } from "$lib/server/model";
import { json } from "@sveltejs/kit";

export async function GET(){
    const instance = getBOTCTClockInstance();
    return json(instance.getState());
}