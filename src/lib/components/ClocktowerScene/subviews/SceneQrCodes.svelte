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
    const VERTICAL_GAP_FRACTION = 0.035;
    // Smaller than the vertical gap - codes stacked side-by-side (the
    // top/bottom rows) read fine closer together than a stacked column.
    const HORIZONTAL_GAP_FRACTION = 0.015;

    let {
        qrCodes,
        visibleHeight,
        z = 0.25
    }: {
        qrCodes: QrCode[];
        visibleHeight: number;
        z?: number;
    } = $props();

    // See GameStatsPanel.svelte's `realHalfWidth` for why this (rather than
    // a fixed design width) is what corner positions must be measured against.
    const { size } = useThrelte();
    const realHalfWidth = $derived(visibleHeight * ($size.width / $size.height) / 2);
    const halfHeight = $derived(visibleHeight / 2);

    const margin = $derived(visibleHeight * MARGIN_FRACTION);
    const codeWidth = $derived(visibleHeight * CODE_WIDTH_FRACTION);
    const verticalGap = $derived(visibleHeight * VERTICAL_GAP_FRACTION);
    const horizontalGap = $derived(visibleHeight * HORIZONTAL_GAP_FRACTION);

    // "top"/"bottom" stack their group in a horizontal row (centred on the
    // anchor); every other position - the pure "left"/"right" edges and all
    // four corners - stacks its group in a vertical column instead.
    const isRow = (pos: QrPosition) => pos === "top" || pos === "bottom";
    // The bottom-row/bottom-corner positions align by their bottom edge
    // rather than being vertically centred like every other position -
    // their card heights vary with title length (see SceneQrCode's
    // canvasAspect), so centering would leave their bottoms at uneven
    // distances from the screen edge.
    const isBottomAligned = (pos: QrPosition) =>
        pos === "bottom-left" || pos === "bottom" || pos === "bottom-right";
    // Corner columns pin to their top/bottom edge and grow inward (toward
    // screen centre) - mirroring how the horizontal corner rows used to pin
    // to their left/right edge. Only the pure "left"/"right" columns centre
    // (DOM: `top: 50%` + translateY(-50%)) - see townsquare/[gameid]/
    // +page.svelte's qr-codes-panel CSS.
    const verticalEdge = (pos: QrPosition): "top" | "bottom" | "center" => {
        switch (pos) {
            case "top-left":
            case "top-right":
                return "top";
            case "bottom-left":
            case "bottom-right":
                return "bottom";
            default:
                return "center";
        }
    };

    function anchorFor(pos: QrPosition): { x: number; y: number } {
        const left = -realHalfWidth + margin + codeWidth / 2;
        const right = realHalfWidth - margin - codeWidth / 2;
        const top = halfHeight - margin - codeWidth / 2;
        // Bottom edge target, not a centre - see isBottomAligned above.
        const bottom = -halfHeight + margin;
        switch (pos) {
            case "top-left": return { x: left, y: top };
            case "top": return { x: 0, y: top };
            case "top-right": return { x: right, y: top };
            case "left": return { x: left, y: 0 };
            case "right": return { x: right, y: 0 };
            case "bottom-left": return { x: left, y: bottom };
            case "bottom": return { x: 0, y: bottom };
            case "bottom-right": return { x: right, y: bottom };
        }
    }

    // One entry per code, stacked along each position group's row (top/
    // bottom groups, left-to-right) or column (left/right groups and all
    // four corners, top-to-bottom) around that position's anchor point.
    const placements = $derived.by(() => {
        const result: { code: QrCode; x: number; y: number; alignBottom: boolean }[] = [];
        for (const pos of QR_POSITIONS) {
            const group = qrCodes.filter((c) => c.position === pos);
            if (group.length === 0) continue;
            const anchor = anchorFor(pos);
            const row = isRow(pos);
            const alignBottom = isBottomAligned(pos);
            const vEdge = verticalEdge(pos);
            const gap = row ? horizontalGap : verticalGap;
            const stride = codeWidth + gap;
            const total = group.length * codeWidth + (group.length - 1) * gap;
            group.forEach((code, i) => {
                // Centred groups (top/bottom rows, left/right columns)
                // spread evenly either side of the anchor. Corner columns
                // instead keep the edge-most code fixed at the anchor and
                // grow the rest inward, so the column never pushes past
                // the top/bottom edge.
                let offset: number;
                if (vEdge === "top") {
                    offset = i * stride;
                } else if (vEdge === "bottom") {
                    offset = -(group.length - 1 - i) * stride;
                } else {
                    offset = -total / 2 + codeWidth / 2 + i * stride;
                }
                result.push({
                    code,
                    x: anchor.x + (row ? offset : 0),
                    y: anchor.y + (row ? 0 : -offset),
                    alignBottom
                });
            });
        }
        return result;
    });
</script>

{#each placements as { code, x, y, alignBottom } (code.position + code.url + code.title)}
    <SceneQrCode
        path={code.url}
        title={code.title}
        placement={{ x, y, width: codeWidth }}
        {z}
        {alignBottom}
    />
{/each}
