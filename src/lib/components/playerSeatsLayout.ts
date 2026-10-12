import { isPlayerToken, type GrimoireStateHistory, type PlacedToken } from "$lib/resources/common/grimoireState";
import type { ScriptCharacter, ScriptWithCharacters } from "$lib/resources/common/gameData";

// Which placed tokens actually represent a player seat (as opposed to a
// travveler/demon-only bluff or some other non-seated marker): anything
// whose character has a player_count > 0 on the loaded script.
export function filterSeatTokens(
    grimoireState: GrimoireStateHistory | null,
    script: ScriptWithCharacters | null
): PlacedToken[] {
    // Loric and fabled never take a seat; they're shown in their own panel (see sideRoleCharacters).
    return (grimoireState?.present.placedTokens ?? []).filter(t => {
        const category = script?.characters.find(c => c.id === t.characterId)?.category;
        return isPlayerToken(t) && category !== 'loric' && category !== 'fabled';
    });
}

// Categories shown in the side rules list (see sideRoleCharacters below), in display order.
// Travellers do take a seat (unlike loric/fabled) but their abilities are as varied as a
// demon's, so they get the same full-rules treatment rather than just a plain seat token.
const SIDE_ROLE_CATEGORIES = ['loric', 'fabled', 'traveler'] as const;

// The loric/fabled/traveller characters on the board (each listed once), grouped by category
// in SIDE_ROLE_CATEGORIES order and then by name within each group.
export function sideRoleCharacters(
    grimoireState: GrimoireStateHistory | null,
    script: ScriptWithCharacters | null
): ScriptCharacter[] {
    const onBoard = new Set((grimoireState?.present.placedTokens ?? []).map(t => t.characterId));
    return (script?.characters ?? [])
        .filter(c => (SIDE_ROLE_CATEGORIES as readonly string[]).includes(c.category) && onBoard.has(c.id))
        .sort((a, b) =>
            SIDE_ROLE_CATEGORIES.indexOf(a.category as typeof SIDE_ROLE_CATEGORIES[number]) -
            SIDE_ROLE_CATEGORIES.indexOf(b.category as typeof SIDE_ROLE_CATEGORIES[number]) ||
            a.name.localeCompare(b.name)
        );
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
// scene) within a `width` x `height` rectangle centred on (0, 0): pulls the
// grim board's own token positions in toward the centre (CONDENSE), then
// scales them back out - the same amount on both axes, so the arrangement
// keeps its shape - until the tokens touch the rectangle's edges on
// whichever axis runs out of room first, picking the largest token size
// that keeps every token inside the rectangle and non-overlapping.
export function computeSeatsLayout(
    tokens: PlacedToken[],
    width: number,
    height: number,
    options: SeatsLayoutOptions
): { tokens: SeatsLayoutToken[]; tokenSize: number } {
    const { minTokenSize, maxTokenSize, edgePadding, condense = 0.6, gapFactor = 0.95 } = options;

    if (tokens.length === 0 || width <= 0 || height <= 0) {
        return { tokens: [], tokenSize: 0 };
    }

    // Half-extents of the space token centres plus their radius must stay within.
    const halfWidth = Math.max(0, width / 2 - edgePadding);
    const halfHeight = Math.max(0, height / 2 - edgePadding);

    if (tokens.length === 1) {
        const tokenSize = Math.min(Math.min(halfWidth, halfHeight) * 1.6, maxTokenSize);
        // Pinned to the top of the area (y grows down, so negative is up)
        // rather than dead centre, with its top edge touching the padded
        // boundary - same as the outermost token in the multi-token layout.
        const y = -(halfHeight - tokenSize / 2);
        return {
            tokens: [{ token: tokens[0], x: 0, y }],
            tokenSize
        };
    }

    const condensed = tokens.map(t => ({ token: t, x: t.x * condense, y: t.y * condense }));

    let maxAbsX = 0;
    let maxAbsY = 0;
    let minDist = Infinity;
    for (let i = 0; i < condensed.length; i++) {
        maxAbsX = Math.max(maxAbsX, Math.abs(condensed[i].x));
        maxAbsY = Math.max(maxAbsY, Math.abs(condensed[i].y));
        for (let j = i + 1; j < condensed.length; j++) {
            minDist = Math.min(minDist, Math.hypot(condensed[i].x - condensed[j].x, condensed[i].y - condensed[j].y));
        }
    }
    if (!isFinite(minDist) || minDist === 0) minDist = Math.min(halfWidth, halfHeight) * 0.5 || 1;

    // Unclamped, a token's radius after scaling is scale * minDist / (2 * gapFactor), and it must fit
    // between the outermost centre and the edge on each axis.
    const tokenRadiusPerScale = minDist / (2 * gapFactor);
    let scale = Math.min(
        halfWidth / (maxAbsX + tokenRadiusPerScale),
        halfHeight / (maxAbsY + tokenRadiusPerScale)
    );
    const naturalTokenSize = scale * minDist / gapFactor;
    const tokenSize = Math.max(minTokenSize, Math.min(maxTokenSize, naturalTokenSize));

    // If the size that falls out of the gap-based formula above had to be clamped, `scale` was
    // solved for a token radius that isn't the one we're actually using, so the outermost token
    // centres would land short of (or past) the edge instead of touching it. Re-solve scale for
    // the real (clamped) radius so the layout actually fills the available space.
    if (tokenSize !== naturalTokenSize) {
        const radius = tokenSize / 2;
        scale = Math.max(0, Math.min(
            maxAbsX > 0 ? (halfWidth - radius) / maxAbsX : Infinity,
            maxAbsY > 0 ? (halfHeight - radius) / maxAbsY : Infinity
        ));
    }

    return {
        tokens: condensed.map(c => ({ token: c.token, x: c.x * scale, y: c.y * scale })),
        tokenSize
    };
}
