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

// A space in a message preset, filled in with a text, character or alignment element each time it's shown.
export type BlankElement = { type: 'blank' };
// An element of a message preset: one of a message's, or a blank.
export type PresetElement = MessageElement | BlankElement;

export function isPresetElement(data: any): data is PresetElement {
    return isMessageElement(data) || (typeof data === 'object' && data !== null && data.type === 'blank');
}

// True once every blank has been filled in, so the message can be shown.
export function hasNoBlanks(elements: PresetElement[]): elements is MessageElement[] {
    return elements.every(e => e.type !== 'blank');
}

// A ready-made message, set up in settings or the grim's communications, and shown from there in one tap (or after
// filling in its blanks).
export type MessagePreset = {
    name: string;
    elements: PresetElement[];
};

export function isMessagePreset(data: any): data is MessagePreset {
    return typeof data === 'object' && data !== null && typeof data.name === 'string' &&
        Array.isArray(data.elements) && data.elements.every(isPresetElement);
}

export function isMessagePresetList(data: any): data is MessagePreset[] {
    return Array.isArray(data) && data.every(isMessagePreset);
}

// A name for a message that hasn't been given one (in the queue, or a preset left unnamed): its first text, without
// the asterisks that make it bold.
export function nameFromElements(elements: PresetElement[]): string {
    return elements.find((e): e is MessageElement & { type: 'text' } => e.type === 'text')?.value.replaceAll('*', '').trim() || 'Custom message';
}

// A preset's name, or one made from its message if it hasn't got one.
export function presetDisplayName(preset: MessagePreset): string {
    return preset.name.trim() || nameFromElements(preset.elements);
}

export type MessageTextPart = { text: string; bold: boolean; alignment: 'good' | 'evil' | null };

// Splits text into the parts it's shown in: text between a pair of asterisks, as in *this*, is bold, and the words
// "good" and "evil" (in any case) are coloured as their alignment.
export function messageTextParts(text: string): MessageTextPart[] {
    const parts: MessageTextPart[] = [];
    let last = 0;
    const addPlain = (plain: string, bold: boolean) => {
        let lastWord = 0;
        for (const match of plain.matchAll(/\b(good|evil)\b/gi)) {
            if (match.index > lastWord) parts.push({ text: plain.slice(lastWord, match.index), bold, alignment: null });
            parts.push({ text: match[0], bold, alignment: match[0].toLowerCase() as 'good' | 'evil' });
            lastWord = match.index + match[0].length;
        }
        if (lastWord < plain.length) parts.push({ text: plain.slice(lastWord), bold, alignment: null });
    };
    for (const match of text.matchAll(/\*([^*]+)\*/g)) {
        if (match.index > last) addPlain(text.slice(last, match.index), false);
        addPlain(match[1], true);
        last = match.index + match[0].length;
    }
    if (last < text.length) addPlain(text.slice(last), false);
    return parts;
}
