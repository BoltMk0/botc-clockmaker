import { listGameSetupsWithCharacters } from "$lib/server/database/games";
import { listScriptsWithCharacters } from "$lib/server/database/scripts";
import type { Actions } from "./$types";

export async function load(){
    try{
        const games = await listGameSetupsWithCharacters();
        const scripts = await listScriptsWithCharacters();
        return {games, scripts};
    } catch(e){
        console.error("Failed to load games or scripts", e);
        return {games: [], scripts: []};
    }
}
