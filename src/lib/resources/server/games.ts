import { v7 } from "uuid";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { getScriptWithCharacters } from "./scripts";
import { isGame, type Game, type GameFull, type NewGame } from "../common/gameData";

export const GAMES_MANAGER = new JSONMultiResourceManager<Game>('games', isGame);

function hydrate(game: Game): GameFull {
    const script = getScriptWithCharacters(game.script_id);
    if (!script) throw new Error(`Failed to load script with id "${game.script_id}" for game setup with id "${game.id}"`);
    return { ...game, script };
}

export function getGameBluffs(gameId: string): string[] {
    return getGameSetup(gameId)?.bluff_ids ?? [];
}

export function setGameBluffs(gameId: string, characterIds: string[]): void {
    const game = getGameSetup(gameId);
    if (!game) throw new Error(`No game found with id "${gameId}"`);
    GAMES_MANAGER.add({ ...game, bluff_ids: characterIds });
}

export function clearGameBluffs(gameId: string): void {
    setGameBluffs(gameId, []);
}

export function getGameCharacters(gameId: string): string[] {
    return getGameSetup(gameId)?.character_ids ?? [];
}

export function getGameSetup(id: string): Game | null {
    return GAMES_MANAGER.get(id) ?? null;
}

export function getFullGame(id: string): GameFull | null {
    const game = getGameSetup(id);
    if (!game) return null;
    return hydrate(game);
}

export function getCharactersForGameSetup(id: string): string[] {
    return getGameCharacters(id);
}

export function listGames(): Game[] {
    return [...GAMES_MANAGER.values];
}

export function listFullGames(): GameFull[] {
    return listGames().map(hydrate);
}

export function createGameSetup(game: NewGame): Game {
    const newGame: Game = {
        id: v7(),
        created: Date.now(),
        last_played: null,
        script_id: game.script_id,
        character_ids: [],
        bluff_ids: []
    };
    const createdGame = GAMES_MANAGER.add(newGame);
    console.log("Created game setup with id", createdGame.id);
    return createdGame;
}

export function deleteGameSetup(id: string): boolean {
    if (!GAMES_MANAGER.get(id)) return false;
    GAMES_MANAGER.delete(id);
    return true;
}

export function setGameSetupCharacters(gameId: string, characterIds: string[], bluffIds: string[]): void {
    const game = getGameSetup(gameId);
    if (!game) throw new Error(`No game found with id "${gameId}"`);
    GAMES_MANAGER.add({ ...game, character_ids: characterIds, bluff_ids: bluffIds });
}
