import { JSONMultiResourceManager } from "./jsonResourceManager";
import { isDrawSession, type DrawSession, type DrawSlot } from "../common/drawSession";

export const DRAW_SESSION_MANAGER = new JSONMultiResourceManager<DrawSession>('draw-sessions', isDrawSession);

function shuffled<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function newDrawSession(clockId: string, scriptId: string, seatCharacterIds: string[], bluffIds: string[], offSeatIds: string[] = [], presetId: string | null = null): DrawSession {
    const shuffledCharacterIds = shuffled(seatCharacterIds);
    const slots: DrawSlot[] = shuffledCharacterIds.map((characterId, i) => ({
        number: i + 1,
        characterId,
        claimed: false,
        playerName: null
    }));
    const session: DrawSession = { id: clockId, scriptId, bluffIds, offSeatIds, presetId, slots };
    DRAW_SESSION_MANAGER.add(session);
    return session;
}

export function get_draw_session_for_clock(clockid: string): DrawSession | null {
    return DRAW_SESSION_MANAGER.get(clockid) ?? null;
}

export function set_draw_session_for_clock(clockid: string, session: DrawSession): void {
    DRAW_SESSION_MANAGER.add(session);
}

export function delete_draw_session_for_clock(clockid: string): void {
    DRAW_SESSION_MANAGER.delete(clockid);
}
