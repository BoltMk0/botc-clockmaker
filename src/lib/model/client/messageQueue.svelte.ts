import { browser } from "$app/environment";
import { isMessageElement, type MessageElement } from "$lib/common/message";
import { v7 } from "uuid";

// A message waiting in the grim's communications queue, to be shown with the others one after another.
export type QueuedMessage = {
    id: string;
    name: string;
    elements: MessageElement[];
};

type StoredQueue = { enabled: boolean; messages: QueuedMessage[] };

function isQueuedMessage(data: any): data is QueuedMessage {
    return typeof data === 'object' && data !== null && typeof data.id === 'string' && typeof data.name === 'string' &&
        Array.isArray(data.elements) && data.elements.every(isMessageElement);
}

const storageKey = (clockid: string) => `messageQueue:${clockid}`;

// The communications queue for a clock: whether new messages go to it rather than being shown, and what's in it.
// Kept in session storage, so it lasts while the storyteller goes to the message page and back.
export class MessageQueue {
    enabled = $state(false);
    messages = $state<QueuedMessage[]>([]);
    readonly #clockid: string;

    constructor(clockid: string) {
        this.#clockid = clockid;
        if (!browser) return;
        try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey(clockid)) ?? 'null');
            if (stored && typeof stored === 'object') {
                this.enabled = stored.enabled === true;
                if (Array.isArray(stored.messages)) this.messages = stored.messages.filter(isQueuedMessage);
            }
        } catch {
            // Start empty
        }
    }

    #save() {
        if (!browser) return;
        const stored: StoredQueue = { enabled: this.enabled, messages: $state.snapshot(this.messages) };
        try {
            sessionStorage.setItem(storageKey(this.#clockid), JSON.stringify(stored));
        } catch {
            // Only kept for this page then
        }
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        this.#save();
    }

    add(name: string, elements: MessageElement[]) {
        this.messages = [...this.messages, { id: v7(), name, elements }];
        this.#save();
    }

    remove(id: string) {
        this.messages = this.messages.filter(m => m.id !== id);
        this.#save();
    }

    // Moves a message up (-1) or down (+1) the queue.
    move(id: string, by: -1 | 1) {
        const from = this.messages.findIndex(m => m.id === id);
        const to = from + by;
        if (from < 0 || to < 0 || to >= this.messages.length) return;
        const messages = [...this.messages];
        [messages[from], messages[to]] = [messages[to], messages[from]];
        this.messages = messages;
        this.#save();
    }

    clear() {
        this.messages = [];
        this.#save();
    }
}
