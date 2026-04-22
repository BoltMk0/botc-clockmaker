import type { ReminderToken } from "../common/types";

export async function fetchReminderTokensForCharacter(characterId: number): Promise<ReminderToken[]> {
    const response = await fetch(`/api/reminder_tokens?characterId=${characterId}`);
    if (!response.ok) {
        throw new Error(`Error fetching reminder tokens: ${response.statusText}`);
    }
    const tokens = await response.json();
    return tokens;
}

export async function createReminderToken(characterId: number): Promise<ReminderToken> {
    const response = await fetch('/api/reminder_tokens', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ characterId })
    });
    if (!response.ok) {
        throw new Error(`Error creating reminder token: ${response.statusText}`);
    }
    const token = await response.json();
    return token;
}

export async function updateReminderToken(id: number, data: Partial<ReminderToken>): Promise<ReminderToken> {
    const response = await fetch(`/api/reminder_tokens/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error(`Error updating reminder token: ${response.statusText}`);
    }
    const updatedToken = await response.json();
    return updatedToken;
}

export async function deleteReminderToken(id: number): Promise<void> {
    const response = await fetch(`/api/reminder_tokens/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error(`Error deleting reminder token: ${response.statusText}`);
    }
}
