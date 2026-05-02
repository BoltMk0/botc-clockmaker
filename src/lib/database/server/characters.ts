import pool from './db';
import type { Character, CharacterCategory, NewCharacter } from '../common/types';
import getPool from './db';

/**
 * Return every character in the database.
 */
export async function listCharacters(): Promise<Character[]> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT id, name, category, rules, player_count, wakes_first_night, wakes_other_nights FROM characters ORDER BY name'
    );
    return rows as Character[];
}

/**
 * Return a single character by name, or null if not found.
 */
export async function getCharacterByName(name: string): Promise<Character | null> {
    const pool = await getPool();

    const [rows] = await pool.query<any[]>(
        'SELECT id, name, category, rules, player_count, wakes_first_night, wakes_other_nights FROM characters WHERE name = ?',
        [name]
    );
    return (rows[0] as Character) ?? null;
}

/**
 * Return a single character by id, or null if not found.
 */
export async function getCharacterById(id: number): Promise<Character | null> {
    const pool = await getPool();

    const [rows] = await pool.query<any[]>(
        'SELECT id, name, category, rules, player_count, wakes_first_night, wakes_other_nights FROM characters WHERE id = ?',
        [id]
    );
    return (rows[0] as Character) ?? null;
}

/**
 * Return all characters belonging to a given category.
 */
export async function listCharactersByCategory(category: CharacterCategory): Promise<Character[]> {
    const pool = await getPool();
    const [rows] = await pool.query<any[]>(
        'SELECT id, name, category, rules, player_count, wakes_first_night, wakes_other_nights FROM characters WHERE category = ? ORDER BY name',
        [category]
    );
    return rows as Character[];
}

/**
 * Insert a new character and return it with its generated id.
 * Throws if a character with the same name already exists.
 */
export async function addCharacter(character: NewCharacter): Promise<Character> {
    const pool = await getPool();
    const [result] = await pool.query<any>(
        'INSERT INTO characters (name, category, rules, player_count, wakes_first_night, wakes_other_nights) VALUES (?, ?, ?, ?, ?, ?)',
        [character.name, character.category, character.rules, character.player_count, character.wakes_first_night, character.wakes_other_nights]
    );
    return { id: result.insertId, ...character };
}

/**
 * Update an existing character's fields. Only the supplied fields are changed.
 * Returns the updated character, or null if the id was not found.
 */
export async function updateCharacter(
    id: number,
    fields: Partial<NewCharacter>
): Promise<Character | null> {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);

    console.debug("Updating character", { id, fields});

    if (entries.length === 0){
        return getCharacterById(id);
    }

    const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    const pool = await getPool();
    await pool.query(`UPDATE characters SET ${setClauses} WHERE id = ?`, [...values, id]);
    return getCharacterById(id);
}

/**
 * Delete a character by id.
 * Returns true if a row was deleted, false if the id was not found.
 */
export async function deleteCharacter(id: number): Promise<boolean> {
    const pool = await getPool();
    const [result] = await pool.query<any>('DELETE FROM characters WHERE id = ?', [id]);
    return result.affectedRows > 0;
}
