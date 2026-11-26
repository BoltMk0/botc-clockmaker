<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { ICON_VIEWBOX, closeIcon, editIcon, inkEraserIcon } from "$lib/icons/material.js";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import DrawableCanvas2 from "$lib/components/DrawableCanvas2/DrawableCanvas2.svelte";
    import type { CanvasLayer, CanvasToolType } from "$lib/components/DrawableCanvas2/types";

    // A blank board to draw on for a player, opened from a message or the bluffs being shown. Closing it goes back to
    // what was being shown (to the grim if there wasn't anything). Nothing is kept once it's closed.
    const PEN: CanvasToolType = { type: 'pen', color: '#ffffff', width: 4 };
    const ERASER: CanvasToolType = { type: 'eraser', width: 30 };

    let layers = $state<CanvasLayer[]>([{ strokes: [] }]);
    // Raw, so it stays the very PEN/ERASER object (a proxy of it would never equal it)
    let tool = $state.raw<CanvasToolType>(PEN);
    let viewScale = $state(1);
    let viewTx = $state(0);
    let viewTy = $state(0);

    // Only back to a page of this grim
    const grim = `/admin/${page.params.clockid}/grim`;
    const returnParam = page.url.searchParams.get('return');
    const returnTo = returnParam?.startsWith(`${grim}/`) ? returnParam : grim;

    // In place of the chalkboard, so the browser's back button doesn't come back to it
    const close = () => goto(returnTo, { replaceState: true });
</script>

<div class="chalkboard">
    <DrawableCanvas2 bind:layers bind:viewScale bind:viewTx bind:viewTy activeLayerIndex={0} {tool} penTool={PEN} eraserTool={ERASER} idleGestures={false}/>

    <div class="tools">
        <button class="tool-btn" class:active={tool === PEN} onclick={() => tool = PEN} title="Pen" aria-label="Pen">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={editIcon}/></svg>
        </button>
        <button class="tool-btn" class:active={tool === ERASER} onclick={() => tool = ERASER} title="Eraser" aria-label="Eraser">
            <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={inkEraserIcon}/></svg>
        </button>
    </div>

    <button class="close-btn" onclick={close} aria-label="Close" title="Back"><MaterialIcon icon={closeIcon} size="1.25em"/></button>
</div>

<style>
    .chalkboard {
        position: fixed;
        inset: 0;
        background: #121212;
        overflow: hidden;
    }

    .tools {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 1;
        display: flex;
        gap: 8px;
    }

    .tool-btn {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        border: none;
        background: rgba(255, 255, 255, 0.12);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        touch-action: manipulation;
    }

    .tool-btn.active {
        background: white;
        color: #121212;
    }

    .tool-btn svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

    /* As on the message page */
    .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 1;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: rgba(255, 255, 255, 0.15);
        color: white;
        font-size: 1.1em;
        line-height: 1;
        cursor: pointer;
        touch-action: manipulation;
    }
</style>
