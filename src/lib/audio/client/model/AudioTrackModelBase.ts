import type { Writable } from "svelte/store";

export interface AudioTrackModelBase {
    get input(): AudioNode;
    
    gain: number;
    pan: number;

    getGainDB(): number;
    setGainDB(gainDB: number): void;

    
    close(): void;
}