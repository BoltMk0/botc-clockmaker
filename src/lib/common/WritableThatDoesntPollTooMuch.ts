import { writable, type Writable } from "svelte/store";

export function writableThatDoesntPollTooMuch<T>(initialValue: T, pollInterval: number = 100): Writable<T> {
    let lastUpdateTime = 0;
    let pendingValue: T | null = null;
    const store = writable<T>(initialValue, set => {
        const interval = setInterval(() => {
            if (pendingValue !== null && Date.now() - lastUpdateTime >= pollInterval) {
                set(pendingValue);
                pendingValue = null;
                lastUpdateTime = Date.now();
            }
        }, pollInterval / 2);

        return () => clearInterval(interval);
    });

    return {
        subscribe: store.subscribe,
        set(value: T) {
            pendingValue = value;
        },
        update(updater: (value: T) => T) {
            pendingValue = updater(pendingValue ?? initialValue);
        }
    };
}