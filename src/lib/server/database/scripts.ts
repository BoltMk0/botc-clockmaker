import pool from './db';
import type { NewScript, Script, ScriptCharacter, ScriptWithCharacters } from '../../common/database/types';
import { getScriptBluffs } from './script_bluffs';

// ── helpers ──────────────────────────────────────────────────────────────────

export async function fetchCharactersForScript(scriptId: number): Promise<ScriptCharacter[]> {
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
    return rows as ScriptCharacter[];
}

// ── scripts ───────────────────────────────────────────────────────────────────

/**
 * Return every script, without their character lists.
 */
export async function listScripts(): Promise<Script[]> {
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
            bluffs: await getScriptBluffs(s.id)
        }))
    );
}

/**
 * Return a single script by id (without characters), or null if not found.
 */
export async function getScriptById(id: number): Promise<Script | null> {
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
    const bluffs = await getScriptBluffs(script.id);
    return { ...script, characters: await fetchCharactersForScript(id), bluffs };
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

    await pool.query(`UPDATE scripts SET ${setClauses} WHERE id = ?`, [...values, id]);
    return getScriptById(id);
}

/**
 * Delete a script by id (cascade removes its script_characters rows).
 * Returns true if a row was deleted, false if the id was not found.
 */
export async function deleteScript(id: number): Promise<boolean> {
    const [result] = await pool.query<any>('DELETE FROM scripts WHERE id = ?', [id]);
    return result.affectedRows > 0;
}

// ── script ↔ character membership ────────────────────────────────────────────

/**
 * Add a single character to a script.
 * Silently succeeds if the character is already on the script.
 */
export async function addCharacterToScript(scriptId: number, characterId: number): Promise<void> {
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
    const [result] = await pool.query<any>(
        'DELETE FROM script_characters WHERE script_id = ? AND character_id = ?',
        [scriptId, characterId]
    );
    return result.affectedRows > 0;
}

/**
 * Replace the entire character list for a script in a single transaction.
 * Any character ids not in the new list are unlinked; any new ones are added.
 */
export async function setScriptCharacters(
    scriptId: number,
    characterIds: number[]
): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM script_characters WHERE script_id = ?', [scriptId]);
        if (characterIds.length > 0) {
            const rows = characterIds.map((cid) => [scriptId, cid]);
            await conn.query(
                'INSERT INTO script_characters (script_id, character_id) VALUES ?',
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
