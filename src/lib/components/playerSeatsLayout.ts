import { isPlayerToken, type GrimoireStateHistory, type PlacedToken } from "$lib/resources/common/grimoireState";
import type { ScriptWithCharacters } from "$lib/resources/common/gameData";

// Which placed tokens actually represent a player seat (as opposed to a
// travveler/demon-only bluff or some other non-seated marker): anything
// whose character has a player_count > 0 on the loaded script.
export function filterSeatTokens(
    grimoireState: GrimoireStateHistory | null,
    script: ScriptWithCharacters | null
): PlacedToken[] {
    return (grimoireState?.present.placedTokens ?? []).filter(isPlayerToken);
}

export type SeatsLayoutToken = { token: PlacedToken; x: number; y: number };
export type SeatsLayoutOptions = {
    minTokenSize: number;
    maxTokenSize: number;
    edgePadding: number;
    // How far tokens are pulled in toward the centre before being scaled
    // back out to fit the available space - see computeSeatsLayout below.
    condense?: number;
    gapFactor?: number;
};

// Lays out seat tokens (in whatever unit `width`/`height`/the option sizes
// are given in - CSS pixels for a DOM view, world units for a Three.js
// scene) within a `width` x `height` area centred on (0, 0): pulls the
// grim board's own token positions in toward the centre (CONDENSE), then
// scales them back out as far as the area allows, picking the largest
// token size that keeps every token inside the area and non-overlapping.
export function computeSeatsLayout(
    tokens: PlacedToken[],
    width: number,
    height: number,
    options: SeatsLayoutOptions
): { tokens: SeatsLayoutToken[]; tokenSize: number } {
    const { minTokenSize, maxTokenSize, edgePadding, condense = 0.6, gapFactor = 1.08 } = options;

    if (tokens.length === 0 || width <= 0 || height <= 0) {
        return { tokens: [], tokenSize: 0 };
    }

    const boardRadius = Math.max(0, Math.min(width, height) / 2 - edgePadding);

    if (tokens.length === 1) {
        return {
            tokens: [{ token: tokens[0], x: 0, y: 0 }],
            tokenSize: Math.min(boardRadius * 1.6, maxTokenSize)
        };
    }

    const condensed = tokens.map(t => ({ token: t, x: t.x * condense, y: t.y * condense }));

    let maxR = 0;
    let minDist = Infinity;
    for (let i = 0; i < condensed.length; i++) {
        maxR = Math.max(maxR, Math.hypot(condensed[i].x, condensed[i].y));
        for (let j = i + 1; j < condensed.length; j++) {
            minDist = Math.min(minDist, Math.hypot(condensed[i].x - condensed[j].x, condensed[i].y - condensed[j].y));
        }
    }
    if (maxR === 0) maxR = 1;
    if (!isFinite(minDist) || minDist === 0) minDist = boardRadius * 0.5 || 1;

    const scale = boardRadius / (maxR + minDist / (2 * gapFactor));
    const tokenSize = Math.max(minTokenSize, Math.min(maxTokenSize, scale * minDist / gapFactor));

    return {
        tokens: condensed.map(c => ({ token: c.token, x: c.x * scale, y: c.y * scale })),
        tokenSize
    };
}
