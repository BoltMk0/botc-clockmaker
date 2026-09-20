export type CustomMessage = {
    title: string;
    subtitle: string;
    /** Character token shown between the title and subtitle; empty for none. */
    characterId?: string;
    /** Character token shown after the subtitle; empty for none. */
    subtitleCharacterId?: string;
}

export function isCustomMessage(data: any): data is CustomMessage {
    return typeof data === 'object' && data !== null &&
        typeof data.title === 'string' &&
        typeof data.subtitle === 'string' &&
        (data.characterId === undefined || typeof data.characterId === 'string') &&
        (data.subtitleCharacterId === undefined || typeof data.subtitleCharacterId === 'string');
}

export function isCustomMessageList(data: any): data is CustomMessage[] {
    return Array.isArray(data) && data.every(isCustomMessage);
}
