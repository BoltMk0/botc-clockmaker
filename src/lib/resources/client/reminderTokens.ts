import type { ReminderToken } from "../common/gameData";

export async function fetchReminderTokensForCharacter(characterId: string): Promise<ReminderToken[]> {
    const response = await fetch(`/api/characters/${characterId}/reminder_tokens`);
    if (!response.ok) {
        throw new Error(`Error fetching reminder tokens: ${response.statusText}`);
    }
    return await response.json();
}

export async function createReminderToken(characterId: string): Promise<ReminderToken> {
    const response = await fetch(`/api/characters/${characterId}/reminder_tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '', textSize: 100 })
    });
    if (!response.ok) {
        throw new Error(`Error creating reminder token: ${response.statusText}`);
    }
    return await response.json();
}

export async function updateReminderToken(
    characterId: string,
    tokenId: string,
    data: Partial<ReminderToken>
): Promise<ReminderToken> {
    const response = await fetch(`/api/characters/${characterId}/reminder_tokens/${tokenId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error(`Error updating reminder token: ${response.statusText}`);
    }
    return await response.json();
}

export async function deleteReminderToken(characterId: string, tokenId: string): Promise<void> {
    const response = await fetch(`/api/characters/${characterId}/reminder_tokens/${tokenId}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error(`Error deleting reminder token: ${response.statusText}`);
    }
}
