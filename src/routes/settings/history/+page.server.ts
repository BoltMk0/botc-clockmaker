import { listPlayHistory } from "$lib/resources/server/presets";

export async function load(){
    return { plays: listPlayHistory() };
}
