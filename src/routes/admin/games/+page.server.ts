import { listFullGames } from "$lib/database/server/games";
import { listScriptsWithCharacters } from "$lib/database/server/scripts";
import { get_grimoire_state_history_resource_for_game } from "$lib/server/grimoire_resource_helper";

export async function load(){
    try{
        const games = await listFullGames();
        const scripts = await listScriptsWithCharacters();
        const gamesWithStates = games.map(game => ({game, grimoireState: get_grimoire_state_history_resource_for_game(game.id)}));
        return {games: gamesWithStates, scripts, error: null};
    } catch(e){
        console.error("Failed to load games or scripts", e);
        return {games: [], scripts: [], error: e};
    }
}
