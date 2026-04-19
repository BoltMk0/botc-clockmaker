import type { Character } from "$lib/common/database/types";
import pool from "./db";

export async function getScriptBluffs(scriptId: number): Promise<Character[]> {
    const [rows] = await pool.query<any[]>(
        `SELECT c.id, c.name, c.category, c.rules
         FROM script_bluffs sb
         JOIN characters c ON sb.character_id = c.id
         WHERE sb.script_id = ?`,
        [scriptId]
    );
    return rows as Character[];
}

export async function setScriptBluffs(scriptId: number, characterIds: number[]): Promise<void> {
    const values = characterIds.map(characterId => [scriptId, characterId]);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            'DELETE FROM script_bluffs WHERE script_id = ?',
            [scriptId]
        );
        if (values.length > 0) {
            await connection.query(
                'INSERT INTO script_bluffs (script_id, character_id) VALUES ?',
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

export async function removeScriptBluff(scriptId: number, characterId: number): Promise<void> {
    await pool.query(
        'DELETE FROM script_bluffs WHERE script_id = ? AND character_id = ?',
        [scriptId, characterId]
    );
}

export async function clearScriptBluffs(scriptId: number): Promise<void> {
    await pool.query(
        'DELETE FROM script_bluffs WHERE script_id = ?',
        [scriptId]
    );
}