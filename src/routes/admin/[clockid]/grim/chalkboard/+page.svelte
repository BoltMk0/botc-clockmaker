<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import DrawableCanvas2 from "$lib/components/DrawableCanvas2/DrawableCanvas2.svelte";
    import type { CanvasLayer, CanvasToolType } from "$lib/components/DrawableCanvas2/types";

    // A blank board to draw on for a player, opened from the grim's communications. Nothing is kept once it's closed.
    const PEN: CanvasToolType = { type: 'pen', color: '#ffffff', width: 4 };
    const ERASER: CanvasToolType = { type: 'eraser', width: 30 };

    let layers = $state<CanvasLayer[]>([{ strokes: [] }]);
    let tool = $state<CanvasToolType>(PEN);
    let viewScale = $state(1);
    let viewTx = $state(0);
    let viewTy = $state(0);
</script>

<div class="chalkboard">
    <DrawableCanvas2 bind:layers bind:viewScale bind:viewTx bind:viewTy activeLayerIndex={0} {tool} penTool={PEN} eraserTool={ERASER} idleGestures={false}/>

    <div class="tools">
        <button class="tool-btn" class:active={tool === PEN} onclick={() => tool = PEN} title="Pen" aria-label="Pen">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"/></svg>
        </button>
        <button class="tool-btn" class:active={tool === ERASER} onclick={() => tool = ERASER} title="Eraser" aria-label="Eraser">
            <svg viewBox="0 0 24 24"><path d="M16.24 3.56L7.05 12.75a2.003 2.003 0 0 0 0 2.83l4.24 4.24c.78.78 2.05.78 2.83 0l9.19-9.19a2.003 2.003 0 0 0 0-2.83L19.07 3.56a2.003 2.003 0 0 0-2.83 0zM5.63 13.34a1.003 1.003 0 0 1 0-1.42l1.41-1.41a1.003 1.003 0 0 1 1.42 0l1.41 1.41a1.003 1.003 0 0 1-1.42 1.42L7.05 14a1.003 1.003 0 0 1-1.42-.08z"/></svg>
        </button>
    </div>

    <button class="close-btn" onclick={() => goto(`/admin/${page.params.clockid}/grim`)} aria-label="Close" title="Back to the grim">✕</button>
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
