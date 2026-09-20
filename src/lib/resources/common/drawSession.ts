export type DrawSlot = {
    number: number;
    characterId: string;
    claimed: boolean; // true once the player has viewed their token and confirmed
    playerName: string | null; // optional - required when a slot is confirmed
    // 1-based position in which players confirmed their token; this is their seat order round the table.
    claimOrder?: number | null;
};

export type DrawSession = {
    id: string; // clockid
    scriptId: string;
    bluffIds: string[];
    // Characters with player_count == 0: nobody draws these, but they still get a token on the grim.
    offSeatIds?: string[];
    // The saved preset this draw was started from, if any.
    presetId?: string | null;
    slots: DrawSlot[];
};

// The redacted view sent to the draw page's bulk GET - never carries unrevealed
// characterIds, since the whole point is that a slot's character stays hidden until
// its own reveal is requested.
export type RedactedDrawSlot = {
    number: number;
    claimed: boolean;
    playerName: string | null;
};

export type RedactedDrawSession = {
    scriptId: string;
    bluffIds: string[];
    slots: RedactedDrawSlot[];
};

export function redactDrawSession(session: DrawSession): RedactedDrawSession {
    return {
        scriptId: session.scriptId,
        bluffIds: session.bluffIds,
        slots: session.slots.map(s => ({ number: s.number, claimed: s.claimed, playerName: s.playerName }))
    };
}

function isDrawSlot(obj: any): obj is DrawSlot {
    return typeof obj === "object" &&
        typeof obj.number === "number" && isFinite(obj.number) &&
        typeof obj.characterId === "string" &&
        typeof obj.claimed === "boolean" &&
        (obj.playerName === null || typeof obj.playerName === "string") &&
        (obj.claimOrder === undefined || obj.claimOrder === null || (typeof obj.claimOrder === "number" && isFinite(obj.claimOrder)));
}

export function isDrawSession(obj: any): obj is DrawSession {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.scriptId === "string" &&
        Array.isArray(obj.bluffIds) && obj.bluffIds.every((id: any) => typeof id === "string") &&
        (obj.offSeatIds === undefined || (Array.isArray(obj.offSeatIds) && obj.offSeatIds.every((id: any) => typeof id === "string"))) &&
        (obj.presetId === undefined || obj.presetId === null || typeof obj.presetId === "string") &&
        Array.isArray(obj.slots) && obj.slots.every(isDrawSlot);
    if (!result) {
        console.error("Invalid DrawSession object:", obj);
    }
    return result;
}
