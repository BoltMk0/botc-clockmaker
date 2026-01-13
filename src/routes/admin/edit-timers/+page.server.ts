import { getBOTCTClockInstance } from "$lib/server/model";
import type { Actions } from "./$types";

export async function load(){
    const config = getBOTCTClockInstance().config;
    return {config};
}
