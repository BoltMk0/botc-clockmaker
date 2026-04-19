import type { NewReminderToken, ReminderToken } from "$lib/common/database/types";
import pool from "./db";

export async function getReminderTokensForCharacter(characterId: number): Promise<ReminderToken[]> {
    const [rows] = await pool.query<any[]>('SELECT * FROM reminder_tokens WHERE character_id = ?', [characterId]);
    return rows;
}

export async function listReminderTokensForScript(scriptId: number): Promise<ReminderToken[]> {
    const [rows] = await pool.query<any[]>(`
        SELECT rt.*
        FROM reminder_tokens rt
        JOIN characters c ON rt.character_id = c.id
        WHERE c.script_id = ?
    `, [scriptId]);
    return rows;
}

export async function getReminderTokenById(id: number): Promise<ReminderToken | null> {
    const [rows] = await pool.query<any[]>('SELECT * FROM reminder_tokens WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
}

export async function createReminderToken(data: NewReminderToken): Promise<ReminderToken> {
    const { character_id, text } = data;
    const [result] = await pool.query<any>('INSERT INTO reminder_tokens (character_id, text) VALUES (?, ?)', [character_id, text]);
    return { id: result.insertId, character_id, text };
}

export async function updateReminderToken(id: number, data: Partial<NewReminderToken>): Promise<ReminderToken | null> {
    const fields = [];
    const values = [];
    if (data.character_id !== undefined) {
        fields.push('character_id = ?');
        values.push(data.character_id);
    }
    if (data.text !== undefined) {
        fields.push('text = ?');
        values.push(data.text);
    }
    if (fields.length === 0) {
        return getReminderTokenById(id);
    }
    values.push(id);
    await pool.query(`UPDATE reminder_tokens SET ${fields.join(', ')} WHERE id = ?`, values);
    return getReminderTokenById(id);
}

export async function deleteReminderToken(id: number): Promise<boolean> {
    const [result] = await pool.query<any>('DELETE FROM reminder_tokens WHERE id = ?', [id]);
    return result.affectedRows > 0;
}
