import type { Writable } from "svelte/store";

export interface AudioTrackBase {
    get gain(): Writable<number>;
    get pan(): Writable<number>;

    getGainDB(): number;
    setGainDB(gainDB: number): void;
    
    close(): void;
}