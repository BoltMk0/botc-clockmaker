import { isMessagePresetList, type MessagePreset } from "$lib/common/message";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

const MESSAGE_PRESETS_MANAGER = new JSONSingletonResourceManager<MessagePreset[]>('message_presets', isMessagePresetList);

// The old communications menu's one-tap messages, as presets to start from.
const DEFAULT_MESSAGE_PRESETS: MessagePreset[] = ['This is your demon', 'These are your minions', 'Speak to me tomorrow']
    .map(text => ({ name: text, elements: [{ type: 'text', value: text, style: 'Header' }] }));

export function saveMessagePresets(presets: MessagePreset[]) {
    MESSAGE_PRESETS_MANAGER.save(presets);
}

export function getMessagePresets(): MessagePreset[] {
    if (MESSAGE_PRESETS_MANAGER.value === null) saveMessagePresets(DEFAULT_MESSAGE_PRESETS);
    return MESSAGE_PRESETS_MANAGER.value ?? [];
}
