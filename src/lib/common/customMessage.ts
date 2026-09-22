// A single section of a custom message, shown top to bottom in the order given.
export type MessageField =
    | { type: 'text'; value: string }
    // A row of character tokens. A null entry is a blank placeholder - not yet a specific
    // character - which the storyteller must fill in with one when they use the message.
    | { type: 'character'; value: (string | null)[] };

export type CustomMessage = {
    fields: MessageField[];
};

function isMessageField(data: any): data is MessageField {
    if (typeof data !== 'object' || data === null) return false;
    if (data.type === 'text') return typeof data.value === 'string';
    if (data.type === 'character') {
        return Array.isArray(data.value) && data.value.every((v: any) => v === null || typeof v === 'string');
    }
    return false;
}

export function isCustomMessage(data: any): data is CustomMessage {
    return typeof data === 'object' && data !== null &&
        Array.isArray(data.fields) && data.fields.every(isMessageField);
}

export function isCustomMessageList(data: any): data is CustomMessage[] {
    return Array.isArray(data) && data.every(isCustomMessage);
}
