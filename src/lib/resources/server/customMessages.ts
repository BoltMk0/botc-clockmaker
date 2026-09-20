import { isCustomMessageList, type CustomMessage } from "$lib/common/customMessage";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

const CUSTOM_MESSAGES_MANAGER = new JSONSingletonResourceManager<CustomMessage[]>('custom_messages', isCustomMessageList);

export function saveCustomMessages(messages: CustomMessage[]) {
    CUSTOM_MESSAGES_MANAGER.save(messages);
}

export function getCustomMessages(): CustomMessage[] {
    return CUSTOM_MESSAGES_MANAGER.value ?? [];
}
