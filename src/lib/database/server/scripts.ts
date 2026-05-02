import pool from './db';
import type { NewScript, Script, ScriptCharacter, ScriptWithCharacters } from '../common/types';
import { getReminderTokensForCharacter } from './reminder_tokens';
import { getGameBluffs } from './games';
import getPool from './db';

// ── helpers ──────────────────────────────────────────────────────────────────

export async function fetchCharactersForScript(scriptId: number): Promise<ScriptCharacter[]> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        `SELECT c.id, c.name, c.category, c.rules, c.player_count, c.wakes_first_night, c.wakes_other_nights,
                sc.first_night_order AS firstNightOrder,
                sc.other_night_order AS otherNightOrder
         FROM characters c
         JOIN script_characters sc ON sc.character_id = c.id
         WHERE sc.script_id = ?
         ORDER BY c.category, c.name`,
        [scriptId]
    );


    const chars = rows as ScriptCharacter[];

    for(const char of chars) {
        char.reminderTokens = await getReminderTokensForCharacter(char.id);
    }

    return chars;
}

// ── scripts ───────────────────────────────────────────────────────────────────

/**
 * Return every script, without their character lists.
 */
export async function listScripts(): Promise<Script[]> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT id, name, hue FROM scripts ORDER BY name'
    );
    return rows as Script[];
}

/**
 * Return every script with their full character lists.
 */
export async function listScriptsWithCharacters(): Promise<ScriptWithCharacters[]> {
    const scripts = await listScripts();
    return Promise.all(
        scripts.map(async (s) => ({
            ...s,
            characters: await fetchCharactersForScript(s.id),
        }))
    );
}

/**
 * Return a single script by id (without characters), or null if not found.
 */
export async function getScriptById(id: number): Promise<Script | null> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT id, name, hue FROM scripts WHERE id = ?',
        [id]
    );
    return (rows[0] as Script) ?? null;
}

/**
 * Return a single script with its full character list, or null if not found.
 */
export async function getScriptWithCharacters(id: number): Promise<ScriptWithCharacters | null> {
    const script = await getScriptById(id);
    if (!script){
        console.warn(`Failed to find script with id "${id}" - not found`);
        return null;
    }
    return { ...script, characters: await fetchCharactersForScript(id) };
}

/**
 * Return all characters belonging to the given script id.
 */
export async function getCharactersForScript(scriptId: number): Promise<ScriptCharacter[]> {
    return fetchCharactersForScript(scriptId);
}

/**
 * Insert a new script and return it with its generated id.
 * Throws if a script with the same name already exists.
 */
export async function createScript(script: NewScript): Promise<Script> {
    const pool = await getPool();
    const [result] = await pool.query<any>(
        'INSERT INTO scripts (name, hue) VALUES (?, ?)',
        [script.name, script.hue]
    );
    return { id: result.insertId, ...script };
}

/**
 * Update a script's name and/or hue.
 * Returns the updated script, or null if the id was not found.
 */
export async function updateScript(
    id: number,
    fields: Partial<NewScript>
): Promise<Script | null> {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return getScriptById(id);

    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const pool = await getPool();
    await pool.query(`UPDATE scripts SET ${setClauses} WHERE id = ?`, [...values, id]);
    return getScriptById(id);
}

/**
 * Delete a script by id (cascade removes its script_characters rows).
 * Returns true if a row was deleted, false if the id was not found.
 */
export async function deleteScript(id: number): Promise<boolean> {
    const pool = await getPool();
    const [result] = await pool.query<any>('DELETE FROM scripts WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

// ── script ↔ character membership ────────────────────────────────────────────

/**
 * Add a single character to a script.
 * Silently succeeds if the character is already on the script.
 */
export async function addCharacterToScript(scriptId: number, characterId: number): Promise<void> {
    const pool = await getPool();
    await pool.query(
        'INSERT IGNORE INTO script_characters (script_id, character_id) VALUES (?, ?)',
        [scriptId, characterId]
    );
}

/**
 * Remove a single character from a script.
 * Returns true if the link existed and was removed.
 */
export async function removeCharacterFromScript(
    scriptId: number,
    characterId: number
): Promise<boolean> {
    const pool = await getPool();
    const [result] = await pool.query<any>(
        'DELETE FROM script_characters WHERE script_id = ? AND character_id = ?',
        [scriptId, characterId]
    );
    return result.affectedRows > 0;
}

export type ScriptCharacterInput = {
    characterId: number;
    firstNightOrder: number | null;
    otherNightOrder: number | null;
};

/**
 * Replace the entire character list for a script in a single transaction.
 * Persists first/other night order columns for each entry.
 */
export async function setScriptCharacters(
    scriptId: number,
    entries: ScriptCharacterInput[]
): Promise<void> {
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM script_characters WHERE script_id = ?', [scriptId]);
        if (entries.length > 0) {
            const rows = entries.map((e) => [
                scriptId,
                e.characterId,
                e.firstNightOrder,
                e.otherNightOrder,
            ]);
            await conn.query(
                'INSERT INTO script_characters (script_id, character_id, first_night_order, other_night_order) VALUES ?',
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
