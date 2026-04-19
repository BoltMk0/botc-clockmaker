import pool from "./db";
import { getScriptWithCharacters } from "./scripts";
import type { Character, Game, GameWithCharacters, NewGame } from "../../common/database/types";

export async function getCharacterIdsForGameSetup(id: number): Promise<number[]> {
    const [rows] = await pool.query<any[]>(
        'SELECT character_id FROM game_characters WHERE game_id = ?',
        [id]
    );

    return Array.from(rows, r=>r.character_id);
}

/**
 * Return a single game by id (without characters), or null if not found.
 */
export async function getGameSetupById(id: number): Promise<Game | null> {
    const [rows] = await pool.query<any[]>(
        'SELECT id, script_id, created, last_played FROM games WHERE id = ?',
        [id]
    );
    return (rows[0] as Game) ?? null;
}

export async function getGameSetupWithCharacters(id: number): Promise<GameWithCharacters | null> {
    const game = await getGameSetupById(id);
    if(game == null) return null;
    const script = await getScriptWithCharacters(game.script_id);
    if(script === null) return null;
    return {...game, script, character_ids: await getCharacterIdsForGameSetup(id)};
}

export async function getCharactersForGameSetup(id: number): Promise<number[]>{
    return getCharacterIdsForGameSetup(id);
}

export async function listGameSetups(): Promise<Game[]>{
    const [rows] = await pool.query<any[]>(
        'SELECT id, created, last_played, script_id FROM games'
    );
    return rows as Game[];
}

export async function listGameSetupsWithCharacters(): Promise<GameWithCharacters[]>{
    const games = await listGameSetups();
    return await Promise.all(Array.from(games, async (game)=>{
        const script = await getScriptWithCharacters(game.script_id);
        if(script === null)throw new Error(`Failed to load script with id "${game.script_id}" for game setup with id "${game.id}"`);
        return {...game, script, character_ids: await getCharacterIdsForGameSetup(game.id)};
    }));
}

export async function createGameSetup(game: NewGame): Promise<Game | null>{
    const [result] = await pool.query<any>(
        'INSERT INTO games (script_id) VALUES (?)',
        [game.script_id]
    );

    const createdGame = await getGameSetupById(result.insertId);
    console.log("Created game setup with id", result.insertId);
    return createdGame;
}


export async function deleteGameSetup(id: number): Promise<boolean>{
    const [result] = await pool.query<any>(
        'DELETE FROM games WHERE id = ?',
        [id]
    );
    return result.affectedRows > 0;
}


/**
 * Replace the entire character list for a script in a single transaction.
 * Any character ids not in the new list are unlinked; any new ones are added.
 */
export async function setGameSetupCharacters(
    gameId: number,
    characterIds: number[]
): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM game_characters WHERE game_id = ?', [gameId]);
        if (characterIds.length > 0) {
            const rows = characterIds.map((cid) => [gameId, cid]);
            await conn.query(
                'INSERT INTO game_characters (game_id, character_id) VALUES ?',
                [rows]
            );
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
