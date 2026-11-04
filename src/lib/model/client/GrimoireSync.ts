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
    // This device has changes that never reached the server, but the server's grimoire has been changed since, after
    // them: which to keep? `local` is when this device last tried to save, `server` when the server's was saved.
    onconflict: (times: { local: number; server: number }) => Promise<'local' | 'server'>;
};

const storageKey = (clockid: string) => `grimoire-state-${clockid}`;

// The copy of the grimoire kept in the browser: the page's state, the revision it was based on, and whether it may
// hold changes the server never had (set as a save starts, and kept if it fails).
type StoredGrimoire = GrimoireStateHistory & { unsynced?: boolean };

function readStored(clockid: string): StoredGrimoire | null {
    try {
        const saved = localStorage.getItem(storageKey(clockid));
        return saved ? JSON.parse(saved) as StoredGrimoire : null;
    } catch {
        return null;
    }
}

// Keeps the grimoire in step between the devices that have it open. Each save goes to the server along with the
// revision it was based on; the server refuses it if someone else has saved since, and this merges its changes into
// theirs and tries again. Every save is broadcast to the other open grims, which merge it into theirs the same way.
//
// A save that fails (offline, or the server's down) leaves this device's changes unsynced, in the browser's copy as
// well, so they survive a reload. The next time this device hears the server's state (on reconnecting, or reloading)
// they aren't merged: if the server's state is older than them, they're uploaded over it; if it's newer, the
// storyteller chooses between the two (see onconflict).
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
    // This device has changes the server may never have had, last tried to be saved at #unsyncedAt
    #unsynced = false;
    #unsyncedAt = 0;
    // The revision the browser's copy of an unsynced grimoire was based on, when the page opened with one
    #storedRevision: string | undefined;
    // Waiting for the storyteller to choose between this device's version and the server's: nothing is sent or taken in
    #resolving = false;

    constructor(private readonly opts: Options) {
        this.#base = structuredClone(opts.serverState);
        const stored = readStored(opts.clockid);
        if (stored?.unsynced) {
            this.#unsynced = true;
            this.#unsyncedAt = stored.present.timestamp;
            this.#storedRevision = stored.revision;
        }
    }

    // The state to open the page with: the server's, unless this browser holds changes to it that never reached
    // the server (made just before a reload, or while offline). Unsynced ones are opened even if the server's has
    // changed since: connect() then sorts out which to keep.
    static initialState(clockid: string, serverState: GrimoireStateHistory): GrimoireStateHistory {
        const stored = readStored(clockid);
        if (!stored) return serverState;
        const { unsynced, ...local } = stored;
        return unsynced || local.revision === serverState.revision ? local : serverState;
    }

    connect() {
        this.#events = new SSEClient(`/admin/${this.opts.clockid}/grim/events`, (msg) => this.#onMessage(msg));
        // Unsynced changes kept from before a reload, when the server's has changed since they were made
        if (this.#unsynced && this.#storedRevision !== this.opts.serverState.revision) this.#reconcile(this.opts.serverState);
        // Changes kept from before a reload
        else if (this.#hasLocalChanges()) this.save();
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

    #storeLocally(history: GrimoireStateHistory, unsynced = this.#unsynced) {
        try {
            const stored: StoredGrimoire = { ...history, revision: this.#base.revision, ...(unsynced ? { unsynced: true } : {}) };
            localStorage.setItem(storageKey(this.opts.clockid), JSON.stringify(stored));
        } catch {
            // Only a backup
        }
    }

    async #saveLoop() {
        while (this.#saveAgain && !this.#closed) {
            this.#saveAgain = false;
            if (this.#resolving) return; // saved once the storyteller has chosen
            if (this.opts.isBusy()) return; // saved once it's finished
            if (this.#pendingRemote !== undefined && !this.#applyPendingRemote()) return;
            if (!this.#hasLocalChanges()) {
                // Nothing the server hasn't got
                if (this.#unsynced) {
                    this.#unsynced = false;
                    this.#storeLocally(this.opts.getLocal());
                }
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
        // Marked unsynced until the server has it, in case the page is closed before it answers
        this.#storeLocally(sent, true);
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
                this.#failed(sent);
                return;
            }
            const { revision } = await response.json();
            this.#unsynced = false;
            // Unless a newer state has already come in from someone else (which, being newer, includes this one)
            if (this.#base.revision === basedOn) this.#base = { ...sent, revision };
            this.#storeLocally(this.opts.getLocal());
            this.opts.onstatus(this.#hasLocalChanges() ? 'saving' : 'saved');
            if (this.#hasLocalChanges()) this.#saveAgain = true;
        } catch (e) {
            console.error(`Failed to save grimoire state: ${e}`);
            this.#failed(sent);
        }
    }

    // The server didn't take this page's changes: they're unsynced until it does (the browser's copy stays marked so).
    #failed(sent: GrimoireStateHistory) {
        this.#unsynced = true;
        this.#unsyncedAt = sent.present.timestamp;
        this.opts.onstatus('error');
    }

    // This device's unsynced changes meet the server's state, which has changed since they were based on it: if it's
    // older than them, they're uploaded over it; if it's newer, the storyteller chooses which to keep.
    #reconcile(remote: GrimoireStateHistory) {
        if (remote.present.timestamp <= this.#unsyncedAt) {
            this.#keepLocal(remote);
            return;
        }
        this.#resolving = true;
        this.opts.onconflict({ local: this.#unsyncedAt, server: remote.present.timestamp }).then(choice => {
            this.#resolving = false;
            if (this.#closed) return;
            // The server's state may have moved on (or been deleted) while they chose
            const latest = this.#pendingRemote !== undefined ? this.#pendingRemote : remote;
            this.#pendingRemote = undefined;
            if (latest === null) {
                this.close();
                this.opts.ondeleted();
            } else if (choice === 'local') {
                this.#keepLocal(latest);
            } else {
                this.#unsynced = false;
                this.#base = structuredClone(latest);
                this.opts.setLocal(structuredClone(latest));
                this.#storeLocally(this.opts.getLocal());
                this.opts.onstatus('saved');
            }
        });
    }

    // Sends this page's state as it is, over the server's (`remote`): based on its revision, so the server takes it.
    #keepLocal(remote: GrimoireStateHistory) {
        this.#base = structuredClone(remote);
        // Not from inside a save loop that's about to stop
        setTimeout(() => this.save());
    }

    #onMessage(msg: WSMessage) {
        if (msg.type !== 'grimoireState' || this.#closed) return;
        // This page's own save, which it already has
        if (msg.origin === this.clientId) return;
        this.#receive(msg.history);
    }

    #receive(remote: GrimoireStateHistory | null) {
        if (remote && remote.revision === this.#base.revision) {
            // Nothing has changed on the server since this device's unsynced changes: send them now
            if (this.#unsynced && !this.#resolving) this.save();
            return;
        }
        this.#pendingRemote = remote;
        if (this.#resolving || this.opts.isBusy()) return;
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
        if (this.#unsynced) {
            this.#reconcile(remote);
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
