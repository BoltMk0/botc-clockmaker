import type { NewReminderToken, ReminderToken } from "$lib/common/database/types";
import pool from "./db";

export async function getReminderTokensForCharacter(characterId: number): Promise<ReminderToken[]> {
    const [rows] = await pool.query<any[]>('SELECT id, character_id, text, text_size FROM reminder_tokens WHERE character_id = ?', [characterId]);
    return rows.map(row => ({
        id: row.id,
        character_id: row.character_id,
        text: row.text,
        textSize: row.text_size
    }));
}

export async function listReminderTokensForScript(scriptId: number): Promise<ReminderToken[]> {
    const [rows] = await pool.query<any[]>(`
        SELECT rt.*
        FROM reminder_tokens rt
        JOIN characters c ON rt.character_id = c.id
        WHERE c.script_id = ?
    `, [scriptId]);
    return rows.map(row => ({
        id: row.id,
        character_id: row.character_id,
        text: row.text,
        textSize: row.text_size
    }));
}

export async function getReminderTokenById(id: number): Promise<ReminderToken | null> {
    const [rows] = await pool.query<any[]>('SELECT * FROM reminder_tokens WHERE id = ?', [id]);
    return rows.length > 0 ? {
        id: rows[0].id,
        character_id: rows[0].character_id,
        text: rows[0].text,
        textSize: rows[0].text_size
    } : null;
}

export async function createReminderToken(data: NewReminderToken): Promise<ReminderToken> {
    const { character_id, text, textSize} = data;
    const [result] = await pool.query<any>('INSERT INTO reminder_tokens (character_id, text, text_size) VALUES (?, ?, ?)', [character_id, text, textSize]);
    return { id: result.insertId, character_id, text, textSize };
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
    if (data.textSize !== undefined) {
        fields.push('text_size = ?');
        values.push(data.textSize);
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
