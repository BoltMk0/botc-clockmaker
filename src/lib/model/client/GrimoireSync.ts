import { v7 } from "uuid";
import type { WSMessage } from "$lib/common/comms";
import type { GrimoireStateHistory } from "$lib/resources/common/grimoireState";
import { mergeGrimoireHistories } from "$lib/resources/common/grimoireMerge";
import { SSEClient } from "./util/sseClient.svelte";

export type GrimoireSaveStatus = 'saved' | 'saving' | 'error';

type Options = {
    clockid: string;
    // The grimoire as the server last had it, when the page loaded.
    serverState: GrimoireStateHistory;
    // The grimoire as it is on this page now (a plain copy), and a way to replace it.
    getLocal: () => GrimoireStateHistory;
    setLocal: (history: GrimoireStateHistory) => void;
    // True while something is half done (a token being dragged, a line being drawn): the page isn't changed under it
    // until it's finished, and nothing is saved.
    isBusy: () => boolean;
    onstatus: (status: GrimoireSaveStatus) => void;
    // The grimoire was deleted (from another device).
    ondeleted: () => void;
};

const storageKey = (clockid: string) => `grimoire-state-${clockid}`;

// Keeps the grimoire in step between the devices that have it open. Each save goes to the server along with the
// revision it was based on; the server refuses it if someone else has saved since, and this merges its changes into
// theirs and tries again. Every save is broadcast to the other open grims, which merge it into theirs the same way.
export class GrimoireSync {
    readonly clientId = v7();
    // The last state this page and the server agreed on
    #base: GrimoireStateHistory;
    // Someone else's newer state, waiting for this page to finish what it's doing (undefined: none; null: deleted)
    #pendingRemote: GrimoireStateHistory | null | undefined = undefined;
    #events: SSEClient | null = null;
    #inFlight: Promise<void> | null = null;
    #saveAgain = false;
    #closed = false;

    constructor(private readonly opts: Options) {
        this.#base = structuredClone(opts.serverState);
    }

    // The state to open the page with: the server's, unless this browser holds changes to it that never reached
    // the server (made just before a reload, or while offline).
    static initialState(clockid: string, serverState: GrimoireStateHistory): GrimoireStateHistory {
        try {
            const saved = localStorage.getItem(storageKey(clockid));
            const local = saved ? JSON.parse(saved) as GrimoireStateHistory : null;
            if (local && local.revision === serverState.revision) return local;
        } catch {
            // Fall back to the server's
        }
        return serverState;
    }

    connect() {
        this.#events = new SSEClient(`/admin/${this.opts.clockid}/grim/events`, (msg) => this.#onMessage(msg));
        // Changes kept from before a reload
        if (this.#hasLocalChanges()) this.save();
    }

    close() {
        this.#closed = true;
        this.#events?.close();
        this.#events = null;
    }

    // Sends this page's changes, if it has any. Also the moment to take in a newer state that arrived while busy.
    save(): Promise<void> {
        this.#saveAgain = true;
        if (!this.#inFlight) {
            this.#inFlight = this.#saveLoop().finally(() => { this.#inFlight = null; });
        }
        return this.#inFlight;
    }

    #hasLocalChanges(): boolean {
        return this.#comparable(this.opts.getLocal()) !== this.#comparable(this.#base);
    }

    // Everything but when it was saved and under what revision
    #comparable(history: GrimoireStateHistory): string {
        const { revision: _, ...rest } = history;
        return JSON.stringify({ ...rest, present: { ...rest.present, timestamp: 0 } });
    }

    #storeLocally(history: GrimoireStateHistory) {
        try {
            localStorage.setItem(storageKey(this.opts.clockid), JSON.stringify({ ...history, revision: this.#base.revision }));
        } catch {
            // Only a backup
        }
    }

    async #saveLoop() {
        while (this.#saveAgain && !this.#closed) {
            this.#saveAgain = false;
            if (this.opts.isBusy()) return; // saved once it's finished
            if (this.#pendingRemote !== undefined && !this.#applyPendingRemote()) return;
            if (!this.#hasLocalChanges()) {
                this.opts.onstatus('saved');
                continue;
            }
            await this.#send();
        }
    }

    async #send() {
        const sent = this.opts.getLocal();
        const basedOn = this.#base.revision;
        sent.revision = basedOn;
        sent.present.timestamp = Date.now();
        this.#storeLocally(sent);
        this.opts.onstatus('saving');
        try {
            const response = await fetch(`/admin/${this.opts.clockid}/grim/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Grim-Client': this.clientId },
                body: JSON.stringify(sent)
            });
            if (response.status === 409) {
                // Someone else saved first: merge into theirs, and send that
                const { current } = await response.json();
                this.#receive(current ?? null);
                this.#saveAgain = true;
                return;
            }
            if (!response.ok) {
                console.error("Failed to save grimoire state:", response.statusText);
                this.opts.onstatus('error');
                return;
            }
            const { revision } = await response.json();
            // Unless a newer state has already come in from someone else (which, being newer, includes this one)
            if (this.#base.revision === basedOn) this.#base = { ...sent, revision };
            this.#storeLocally(this.opts.getLocal());
            this.opts.onstatus(this.#hasLocalChanges() ? 'saving' : 'saved');
            if (this.#hasLocalChanges()) this.#saveAgain = true;
        } catch (e) {
            console.error(`Failed to save grimoire state: ${e}`);
            this.opts.onstatus('error');
        }
    }

    #onMessage(msg: WSMessage) {
        if (msg.type !== 'grimoireState' || this.#closed) return;
        // This page's own save, which it already has
        if (msg.origin === this.clientId) return;
        this.#receive(msg.history);
    }

    #receive(remote: GrimoireStateHistory | null) {
        if (remote && remote.revision === this.#base.revision) return;
        this.#pendingRemote = remote;
        if (this.opts.isBusy()) return;
        if (this.#applyPendingRemote() && this.#hasLocalChanges()) this.save();
    }

    // Takes in the newer state, keeping this page's changes on top of it. False if the grimoire has been deleted.
    #applyPendingRemote(): boolean {
        const remote = this.#pendingRemote;
        this.#pendingRemote = undefined;
        if (remote === undefined) return true;
        if (remote === null) {
            this.close();
            this.opts.ondeleted();
            return false;
        }
        const local = this.opts.getLocal();
        const next = this.#hasLocalChanges() ? mergeGrimoireHistories(this.#base, local, remote) : remote;
        this.#base = structuredClone(remote);
        this.opts.setLocal(structuredClone({ ...next, revision: remote.revision }));
        this.#storeLocally(this.opts.getLocal());
        return true;
    }
}
