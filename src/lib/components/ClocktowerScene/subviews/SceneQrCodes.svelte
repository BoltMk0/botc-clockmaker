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
    const GAP_FRACTION = 0.035;

    let {
        qrCodes,
        visibleHeight,
        z = 0.05
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
    const gap = $derived(visibleHeight * GAP_FRACTION);

    const isVertical = (pos: QrPosition) => pos === "left" || pos === "right";

    function anchorFor(pos: QrPosition): { x: number; y: number } {
        const left = -realHalfWidth + margin + codeWidth / 2;
        const right = realHalfWidth - margin - codeWidth / 2;
        const top = halfHeight - margin - codeWidth / 2;
        const bottom = -halfHeight + margin + codeWidth / 2;
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
    // bottom groups, left-to-right) or column (left/right groups, top-to-
    // bottom) around that position's anchor point - mirrors the DOM
    // version's flex layout.
    const placements = $derived.by(() => {
        const result: { code: QrCode; x: number; y: number }[] = [];
        for (const pos of QR_POSITIONS) {
            const group = qrCodes.filter((c) => c.position === pos);
            if (group.length === 0) continue;
            const anchor = anchorFor(pos);
            const vertical = isVertical(pos);
            const stride = codeWidth + gap;
            const total = group.length * codeWidth + (group.length - 1) * gap;
            group.forEach((code, i) => {
                const offset = -total / 2 + codeWidth / 2 + i * stride;
                result.push({
                    code,
                    x: anchor.x + (vertical ? 0 : offset),
                    y: anchor.y + (vertical ? -offset : 0)
                });
            });
        }
        return result;
    });
</script>

{#each placements as { code, x, y } (code.position + code.url + code.title)}
    <SceneQrCode path={code.url} title={code.title} placement={{ x, y, width: codeWidth }} {z} />
{/each}
