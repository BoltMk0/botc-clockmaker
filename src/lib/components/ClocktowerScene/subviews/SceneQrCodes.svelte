<script lang="ts">
    import { useThrelte } from "@threlte/core";
    import SceneQrCode from "./SceneQrCode.svelte";
    import { QR_POSITIONS, type QrPosition } from "$lib/resources/common/qrCodes";
    import type { QrCode } from "$lib/resources/server/qrCodes";

    // Lays the configured QR codes out at the edges/corners of the visible
    // scene (the same 8 positions used by the DOM overlay - see
    // townsquare/[gameid]/+page.svelte's qr-codes-panel), but as scene
    // objects sitting behind the player seat tokens rather than a separate
    // DOM layer on top of everything - see SceneQrCode.svelte.
    const MARGIN_FRACTION = 0.018; // 0.03 - 40%
    const CODE_WIDTH_FRACTION = 0.12;
    // Space between cards, edge to edge, in a column and in a row.
    const VERTICAL_GAP_FRACTION = 0.01;
    const HORIZONTAL_GAP_FRACTION = 0.015;

    let {
        qrCodes,
        visibleHeight,
        scale = 1,
        z = 0.25
    }: {
        qrCodes: QrCode[];
        visibleHeight: number;
        /** Multiplies the codes' default width. */
        scale?: number;
        z?: number;
    } = $props();

    // See GameStatsPanel.svelte's `realHalfWidth` for why this (rather than
    // a fixed design width) is what corner positions must be measured against.
    const { size } = useThrelte();
    const realHalfWidth = $derived(visibleHeight * ($size.width / $size.height) / 2);
    const halfHeight = $derived(visibleHeight / 2);

    const margin = $derived(visibleHeight * MARGIN_FRACTION);
    const codeWidth = $derived(visibleHeight * CODE_WIDTH_FRACTION * scale);
    const verticalGap = $derived(visibleHeight * VERTICAL_GAP_FRACTION);
    const horizontalGap = $derived(visibleHeight * HORIZONTAL_GAP_FRACTION);

    // Each card's height/width, as reported once it's drawn: cards grow
    // taller the more lines their title wraps to, so stacking has to use
    // their real heights rather than assuming every card is the same.
    let aspects: Record<string, number> = $state({});
    const keyOf = (code: QrCode) => code.position + code.url + code.title;
    const heightOf = (code: QrCode) => codeWidth * (aspects[keyOf(code)] ?? 1);

    // "top"/"bottom" stack their group in a horizontal row (centred on the
    // anchor); every other position - the pure "left"/"right" edges and all
    // four corners - stacks its group in a vertical column instead.
    const isRow = (pos: QrPosition) => pos === "top" || pos === "bottom";
    // Which screen edge a position's cards line up against vertically.
    // Corner columns pin to their top/bottom edge and grow inward (toward
    // screen centre); only the pure "left"/"right" columns centre (DOM:
    // `top: 50%` + translateY(-50%)) - see townsquare/[gameid]/
    // +page.svelte's qr-codes-panel CSS. The top/bottom rows line their
    // cards up by their top/bottom edges, so cards of different heights
    // sit at an even distance from the screen edge.
    const verticalEdge = (pos: QrPosition): "top" | "bottom" | "center" => {
        switch (pos) {
            case "top-left":
            case "top":
            case "top-right":
                return "top";
            case "bottom-left":
            case "bottom":
            case "bottom-right":
                return "bottom";
            default:
                return "center";
        }
    };

    function anchorX(pos: QrPosition): number {
        switch (pos) {
            case "top-left":
            case "left":
            case "bottom-left":
                return -realHalfWidth + margin + codeWidth / 2;
            case "top-right":
            case "right":
            case "bottom-right":
                return realHalfWidth - margin - codeWidth / 2;
            default:
                return 0;
        }
    }

    // The card's centre y, given the y of the edge it lines up against.
    function centreFrom(edgeY: number, vEdge: "top" | "bottom" | "center", height: number): number {
        if (vEdge === "top") return edgeY - height / 2;
        if (vEdge === "bottom") return edgeY + height / 2;
        return edgeY;
    }

    // One entry per code, stacked along each position group's row (top/
    // bottom groups, left-to-right) or column (left/right groups and all
    // four corners, top-to-bottom).
    const placements = $derived.by(() => {
        const result: { code: QrCode; x: number; y: number }[] = [];
        const top = halfHeight - margin;
        const bottom = -halfHeight + margin;
        for (const pos of QR_POSITIONS) {
            const group = qrCodes.filter((c) => c.position === pos);
            if (group.length === 0) continue;
            const x = anchorX(pos);
            const vEdge = verticalEdge(pos);
            if (isRow(pos)) {
                // Side by side, centred on the anchor
                const stride = codeWidth + horizontalGap;
                const total = group.length * codeWidth + (group.length - 1) * horizontalGap;
                const edgeY = vEdge === "top" ? top : bottom;
                group.forEach((code, i) => {
                    result.push({
                        code,
                        x: x - total / 2 + codeWidth / 2 + i * stride,
                        y: centreFrom(edgeY, vEdge, heightOf(code))
                    });
                });
                continue;
            }
            // A column, top to bottom. Corner columns keep the edge-most card
            // against their edge and grow the rest inward, so the column
            // never pushes past the top/bottom of the screen.
            const heights = group.map(heightOf);
            const total = heights.reduce((a, b) => a + b, 0) + (group.length - 1) * verticalGap;
            let cursor = vEdge === "top" ? top : vEdge === "bottom" ? bottom + total : total / 2;
            group.forEach((code, i) => {
                result.push({ code, x, y: cursor - heights[i] / 2 });
                cursor -= heights[i] + verticalGap;
            });
        }
        return result;
    });
</script>

{#each placements as { code, x, y } (keyOf(code))}
    <SceneQrCode
        path={code.url}
        title={code.title}
        placement={{ x, y, width: codeWidth }}
        {z}
        onaspect={(aspect) => aspects[keyOf(code)] = aspect}
    />
{/each}
