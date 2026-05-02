import pool from "./db";
import { getScriptWithCharacters } from "./scripts";
import type { Character, Game, GameFull, NewGame } from "../common/types";
import getPool from "./db";




/////////////////////  BLUFFS  ///////////////////

export async function getGameBluffs(gameId: number): Promise<number[]> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        `SELECT character_id
         FROM game_bluffs
         WHERE game_id = ?`,
        [gameId]
    );
    return rows.map(r => r.character_id);
}

export async function setGameBluffs(gameId: number, characterIds: number[]): Promise<void> {
    const values = characterIds.map(characterId => [gameId, characterId]);
    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            'DELETE FROM game_bluffs WHERE game_id = ?',
            [gameId]
        );
        if (values.length > 0) {
            await connection.query(
                'INSERT INTO game_bluffs (game_id, character_id) VALUES ?',
                [values]
            );
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function clearGameBluffs(gameId: number): Promise<void> {
    const pool = await getPool();
    await pool.query(
        'DELETE FROM game_bluffs WHERE game_id = ?',
        [gameId]
    );
}









/////////////////////  CHARACTERS  //////////////////////


export async function getGameCharacters(gameId: number): Promise<number[]> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT character_id FROM game_characters WHERE game_id = ?',
        [gameId]
    );

    return Array.from(rows, r=>r.character_id);
}


/**
 * Return a single game by id (without characters), or null if not found.
 */
export async function getGameSetup(id: number): Promise<Game | null> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT id, script_id, created, last_played FROM games WHERE id = ?',
        [id]
    );
    return (rows[0] as Game) ?? null;
}

export async function getFullGame(id: number): Promise<GameFull | null> {
    const game = await getGameSetup(id);
    if(game == null) return null;
    const script = await getScriptWithCharacters(game.script_id);
    if(script === null) return null;
    const bluff_ids = await getGameBluffs(id);
    const character_ids = await getGameCharacters(id);
    return {...game, script, character_ids, bluff_ids};
}

export async function getCharactersForGameSetup(id: number): Promise<number[]>{
    return getGameCharacters(id);
}

export async function listGames(): Promise<Game[]>{
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT id, created, last_played, script_id FROM games'
    );
    return rows as Game[];
}

export async function listFullGames(): Promise<GameFull[]>{
    const games = await listGames();
    return await Promise.all(Array.from(games, async (game)=>{
        const script = await getScriptWithCharacters(game.script_id);
        if(script === null)throw new Error(`Failed to load script with id "${game.script_id}" for game setup with id "${game.id}"`);
        const bluff_ids = await getGameBluffs(game.id);
        const character_ids = await getGameCharacters(game.id);
        return {...game, script, character_ids, bluff_ids};
    }));
}

export async function createGameSetup(game: NewGame): Promise<Game | null>{
    const pool = await getPool();
    const [result] = await pool.query<any>(
        'INSERT INTO games (script_id) VALUES (?)',
        [game.script_id]
    );

    const createdGame = await getGameSetup(result.insertId);
    console.log("Created game setup with id", result.insertId);
    return createdGame;
}


export async function deleteGameSetup(id: number): Promise<boolean>{
    const pool = await getPool();
    const [result] = await pool.query<any>(
        'DELETE FROM games WHERE id = ?',
        [id]
    );
    return result.affectedRows > 0;
}


/**
 * Replace the entire character list for a game in a single transaction.
 * Any character ids not in the new list are unlinked; any new ones are added.
 */
export async function setGameSetupCharacters(
    gameId: number,
    characterIds: number[],
    bluffIds: number[]
): Promise<void> {
    const pool = await getPool();
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
        await conn.query('DELETE FROM game_bluffs WHERE game_id = ?', [gameId]);
        if (bluffIds.length > 0) {
            const rows = bluffIds.map((cid) => [gameId, cid]);
            await conn.query(
                'INSERT INTO game_bluffs (game_id, character_id) VALUES ?',
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
