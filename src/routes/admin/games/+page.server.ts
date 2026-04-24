import { listFullGames } from "$lib/database/server/games";
import { listScriptsWithCharacters } from "$lib/database/server/scripts";
import { get_grimoire_state_history_resource_for_game } from "$lib/resources/server/grimoire-state";
import { isGrimoireStateHistory, type GrimoireStateHistory } from "./[id]/grimoire/types";

export async function load(){
    try{
        const games = await listFullGames();
        const scripts = await listScriptsWithCharacters();
        const gamesWithStates = games.map(game => ({game, grimoireState: get_grimoire_state_history_resource_for_game(game.id) as GrimoireStateHistory})).map(({game, grimoireState}) => ({game, grimoireState: isGrimoireStateHistory(grimoireState) ? grimoireState : null}));
        return {games: gamesWithStates, scripts, error: null};
    } catch(e){
        console.error("Failed to load games or scripts", e);
        return {games: [], scripts: [], error: e};
    }
}
