import { isTextOptionList, type TextOption } from "$lib/common/message";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

const TEXT_OPTIONS_MANAGER = new JSONSingletonResourceManager<TextOption[]>('text_options', isTextOptionList);

// What the communications menu used to offer, as text options to start from.
const DEFAULT_TEXT_OPTIONS: TextOption[] = [
    { text: 'This is your demon', style: 'Header' },
    { text: 'These are your minions', style: 'Header' },
    { text: 'This character has selected you', style: 'Header' },
    { text: 'You are', style: 'Header' },
    { text: 'Speak to me tomorrow', style: 'Header' },
    { text: '...to be mad that this player is evil...', style: 'Text' },
    { text: '...and is this player...', style: 'Text' },
    { text: '...to be mad that you are this character...', style: 'Text' },
    { text: '...and you are on the EVIL team', style: 'Text' },
    { text: '...and you are on the GOOD team', style: 'Text' },
];

// Saved messages used to be stacks of text and character fields. Their text carries over as text options:
// the first field was shown as the title, so a first text field becomes a Header and the rest Text.
type LegacyMessage = { fields: { type: string; value: unknown }[] };
function legacyMessageTexts(): TextOption[] {
    const legacy = new JSONSingletonResourceManager<LegacyMessage[]>('custom_messages').value;
    if (!Array.isArray(legacy)) return [];
    return legacy.flatMap(message => (message?.fields ?? []).flatMap((field, i): TextOption[] =>
        field.type === 'text' && typeof field.value === 'string' && field.value.trim()
            ? [{ text: field.value.trim(), style: i === 0 ? 'Header' : 'Text' }]
            : []
    ));
}

export function saveTextOptions(options: TextOption[]) {
    TEXT_OPTIONS_MANAGER.save(options);
}

export function getTextOptions(): TextOption[] {
    if (TEXT_OPTIONS_MANAGER.value === null) {
        const options: TextOption[] = [];
        for (const option of [...DEFAULT_TEXT_OPTIONS, ...legacyMessageTexts()]) {
            if (!options.some(o => o.text === option.text)) options.push(option);
        }
        saveTextOptions(options);
    }
    return TEXT_OPTIONS_MANAGER.value ?? [];
}
