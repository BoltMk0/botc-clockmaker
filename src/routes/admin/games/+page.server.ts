import { listFullGames } from "$lib/resources/server/games";
import { listScriptsWithCharacters } from "$lib/resources/server/scripts";
import { get_grimoire_state_history_resource_for_game } from "$lib/resources/server/grimoire-state";
import { isGrimoireStateHistory, type GrimoireStateHistory } from "./[id]/grimoire/types";

export async function load(){
    try{
        const games = listFullGames();
        const scripts = listScriptsWithCharacters();
        const gamesWithStates = games.map(game => ({game, grimoireState: get_grimoire_state_history_resource_for_game(game.id) as GrimoireStateHistory})).map(({game, grimoireState}) => ({game, grimoireState: isGrimoireStateHistory(grimoireState) ? grimoireState : null}));
        return {games: gamesWithStates, scripts, error: null};
    } catch(e){
        console.error("Failed to load games or scripts", e);
        return {games: [], scripts: [], error: e};
    }
}
