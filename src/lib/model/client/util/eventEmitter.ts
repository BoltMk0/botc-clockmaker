/**
 * Minimal browser-safe stand-in for Node's EventEmitter, built on the native EventTarget.
 * Node's `events` module is externalized (not polyfilled) by Vite for client bundles,
 * so it cannot be imported from browser code.
 */
export class EventEmitter<Events extends Record<string, unknown[]> = Record<string, unknown[]>> {
    readonly #target = new EventTarget();
    readonly #wrappers = new Map<string, Map<(...args: any[]) => void, EventListener>>();

    on<K extends keyof Events & string>(eventName: K, listener: (...args: Events[K]) => void): this {
        const wrapper: EventListener = (e) => listener(...((e as CustomEvent<Events[K]>).detail));
        let listeners = this.#wrappers.get(eventName);
        if (!listeners) {
            listeners = new Map();
            this.#wrappers.set(eventName, listeners);
        }
        listeners.set(listener, wrapper);
        this.#target.addEventListener(eventName, wrapper);
        return this;
    }

    off<K extends keyof Events & string>(eventName: K, listener: (...args: Events[K]) => void): this {
        const wrapper = this.#wrappers.get(eventName)?.get(listener);
        if (wrapper) {
            this.#target.removeEventListener(eventName, wrapper);
            this.#wrappers.get(eventName)?.delete(listener);
        }
        return this;
    }

    emit<K extends keyof Events & string>(eventName: K, ...args: Events[K]): boolean {
        return this.#target.dispatchEvent(new CustomEvent(eventName, { detail: args }));
    }
}
