// How a line of text is shown: a Header in large type, or Text smaller beneath it.
export const TEXT_STYLES = ['Header', 'Text'] as const;
export type TextStyle = typeof TEXT_STYLES[number];

// A line of text the storyteller can add to a message - see the grim's communications builder.
export type TextOption = {
    text: string;
    style: TextStyle;
};

// A single element of a message to show a player, shown top to bottom in the order given.
export type MessageElement =
    | { type: 'text'; value: string; style: TextStyle }
    // A row of character tokens.
    | { type: 'character'; value: string[] }
    | { type: 'alignment'; value: 'good' | 'evil' };

function isTextStyle(data: unknown): data is TextStyle {
    return TEXT_STYLES.includes(data as TextStyle);
}

export function isTextOption(data: any): data is TextOption {
    return typeof data === 'object' && data !== null && typeof data.text === 'string' && isTextStyle(data.style);
}

export function isTextOptionList(data: any): data is TextOption[] {
    return Array.isArray(data) && data.every(isTextOption);
}

export function isMessageElement(data: any): data is MessageElement {
    if (typeof data !== 'object' || data === null) return false;
    if (data.type === 'text') return typeof data.value === 'string' && isTextStyle(data.style);
    if (data.type === 'character') return Array.isArray(data.value) && data.value.every((v: any) => typeof v === 'string');
    if (data.type === 'alignment') return data.value === 'good' || data.value === 'evil';
    return false;
}
