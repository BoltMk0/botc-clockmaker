<script lang="ts" module>
    import type { GrimoireStateSnapshot } from "$lib/resources/common/grimoireState.js";

    // Changes made to a snapshot, kept while its timing stats are open (on their own page) to come back to
    const drafts = new Map<string, GrimoireStateSnapshot>();
</script>

<script lang="ts">
    import "$lib/components/grim/grimUi.css";
    import { ICON_VIEWBOX, barChartIcon, closeIcon, fitScreenIcon, photoCameraIcon, restartAltIcon } from "$lib/icons/material.js";
    import { onMount, tick } from "svelte";
    import { domToPng } from "modern-screenshot";
    import type { ScriptCharacter, ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import { BOARD_TOKEN_SIZE, type GrimoireStateHistory } from "$lib/resources/common/grimoireState.js";
    import { fetchAllCharacters, fetchScriptWithSideCharacters } from "$lib/resources/client/scriptWithSideCharacters.js";
    import { GrimoireUndo } from "$lib/model/client/GrimoireUndo.svelte";
    import GrimBoard from "$lib/components/grim/GrimBoard.svelte";
    import GrimPieces from "$lib/components/grim/GrimPieces.svelte";
    import { goto } from "$app/navigation";
    import { GRIM_Z, GrimModel, asScriptCharacters, normaliseHistory, scriptSummaries, type GrimScriptSummary } from "$lib/components/grim/GrimModel.svelte";

    // A grim as it was saved, shown over the whole page on the grim board, where it can be changed (tokens and
    // reminders added, moved or taken off, players changed, lines drawn) before it's saved as a picture. The changes
    // are only ever kept here: the saved grim stays as it was.

    let { snapshot, scriptId = null, title, filename = 'grim', winner, when, day, draftKey, statsHref, onclose }: {
        snapshot: GrimoireStateSnapshot;
        /** The script the game was played with, for its characters in the token tray. */
        scriptId?: string | null;
        title: string;
        /** The saved PNG's name, without the extension. */
        filename?: string;
        /** Shown large in the middle of the town, when the game's result is known. */
        winner?: 'good' | 'evil';
        /** Small text under the winner, e.g. when the game ended. */
        when?: string;
        /** The in-game day the game ended on, shown under the winner. */
        day?: number;
        /** Names the snapshot, to keep its changes while its timing stats are open. */
        draftKey?: string;
        /** The page with the game's timing stats; absent when they weren't saved. */
        statsHref?: string;
        onclose: () => void;
    } = $props();

    const tokenSize = BOARD_TOKEN_SIZE;
    const reminderTokenSize = Math.round(tokenSize * 0.56);

    // The grim as saved (a copy each time, to change). The tokens were all given an alignment when they were saved.
    const saved = (): GrimoireStateHistory => normaliseHistory({
        id: 'snapshot',
        scriptId,
        loadedPreset: null,
        saveslots: [],
        present: structuredClone($state.snapshot(snapshot))
    }, () => 'good');

    // As it was changed before the timing stats were opened, if they were (only the once: the draft is used up)
    // svelte-ignore state_referenced_locally
    const draft = draftKey ? drafts.get(draftKey) : undefined;
    // svelte-ignore state_referenced_locally
    if (draftKey) drafts.delete(draftKey);
    // svelte-ignore state_referenced_locally
    let grim = $state(draft ? { ...saved(), present: draft } : saved());
    // Whether it was brought back changed (which undo doesn't know about)
    let restoredChanges = $state(!!draft);
    let script = $state<ScriptWithCharacters | null>(null);
    let library = $state<ScriptCharacter[]>([]);
    let scripts = $state<GrimScriptSummary[]>([]);

    const model = new GrimModel({
        grim: () => grim,
        script: () => script,
        library: () => library,
        scripts: () => scripts
    });

    const undo = new GrimoireUndo(() => grim);
    let board = $state<GrimBoard>();
    // Whether a token or reminder is being dragged on the board, which hides the Close button as it hides its own
    let dragging = $state(false);
    // Whether the grim has been changed from how it was saved (and not all undone)
    const changed = $derived(undo.canUndo || restoredChanges);

    // Puts the grim back as it was saved.
    function reset() {
        if (!confirm('Put the grim back as it was saved? Your changes will be lost.')) return;
        board?.closeReminderTray();
        grim.present = saved().present;
        undo.clear();
        restoredChanges = false;
        board?.fitView();
    }


    // Opens the timing stats, keeping the changes to come back to
    function openStats() {
        if (!statsHref) return;
        if (draftKey && changed) drafts.set(draftKey, $state.snapshot(grim.present));
        goto(statsHref);
    }

    function onkeydown(e: KeyboardEvent) {
        // Escape in a text box (a player's name) only leaves the box
        if (e.key !== 'Escape' || (e.target as Element | null)?.closest('input, textarea')) return;
        onclose();
    }

    // SAVING AS PNG
    // The whole grim is laid out again off to the side at full size, cropped to everything on it plus a margin, and
    // captured from there, so the picture doesn't depend on how the view is panned or zoomed.
    const EXPORT_PADDING = 80;
    const EXPORT_SCALE = 2;
    // Roughly how far the winner text reaches from the centre.
    const WINNER_HALF_SIZE = { x: 200, y: 200 };

    let exporting = $state(false);
    let exportEl = $state<HTMLElement>();
    let exportCanvas = $state<HTMLCanvasElement>();

    const layers = $derived(grim.present.canvas.layers);

    const exportBounds = $derived.by(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const include = (x: number, y: number, halfW: number, halfH = halfW) => {
            minX = Math.min(minX, x - halfW); maxX = Math.max(maxX, x + halfW);
            minY = Math.min(minY, y - halfH); maxY = Math.max(maxY, y + halfH);
        };
        for (const t of model.placedTokens) include(t.x, t.y, tokenSize / 2);
        for (const r of model.placedReminders) include(r.x, r.y, reminderTokenSize / 2);
        for (const layer of layers) for (const stroke of layer.strokes) {
            if (stroke.tool.type !== 'pen') continue;
            for (const p of stroke.points) include(p.x, p.y, stroke.tool.width / 2);
        }
        if (winner) include(0, 0, WINNER_HALF_SIZE.x, WINNER_HALF_SIZE.y);
        if (minX === Infinity) include(0, 0, tokenSize);
        return {
            minX: Math.floor(minX - EXPORT_PADDING),
            minY: Math.floor(minY - EXPORT_PADDING),
            width: Math.ceil(maxX - minX + EXPORT_PADDING * 2),
            height: Math.ceil(maxY - minY + EXPORT_PADDING * 2)
        };
    });

    function drawExportStrokes() {
        const ctx = exportCanvas?.getContext('2d');
        if (!ctx) return;
        const { minX, minY, width, height } = exportBounds;
        ctx.clearRect(0, 0, width, height);
        ctx.setTransform(1, 0, 0, 1, -minX, -minY);
        for (const layer of layers) for (const stroke of layer.strokes) {
            if (stroke.points.length === 0) continue;
            ctx.save();
            ctx.lineWidth = stroke.tool.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = stroke.tool.type === 'eraser' ? 'destination-out' : 'source-over';
            const colour = stroke.tool.type === 'pen' ? stroke.tool.color : '#000';
            ctx.strokeStyle = colour;
            ctx.fillStyle = colour;
            ctx.beginPath();
            if (stroke.points.length === 1) {
                ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.tool.width / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    async function saveAsPng() {
        if (exporting) return;
        exporting = true;
        try {
            await tick();
            if (!exportEl) throw new Error('Nothing to save');
            drawExportStrokes();
            // Wait for every token image and the fonts, or they'd be missing from the picture.
            await Promise.all([...exportEl.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
            await document.fonts.ready;
            const url = await domToPng(exportEl, { scale: EXPORT_SCALE });
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.png`;
            link.click();
        } catch (er) {
            alert(`Failed to save the picture: ${er}`);
        } finally {
            exporting = false;
        }
    }

    onMount(() => {
        // The characters (which also frame the town: loric and fabled are left out), and the scripts for the tray
        Promise.all([
            fetchAllCharacters().then(all => library = asScriptCharacters(all)),
            scriptId ? fetchScriptWithSideCharacters(scriptId).then(s => script = s).catch(() => {}) : null
        ]).then(() => board?.fitView());
        fetch('/api/scripts')
            .then(r => r.ok ? r.json() : [])
            .then(list => scripts = scriptSummaries(list))
            .catch(() => {});
    });
</script>

{#snippet winnerBanner()}
    {#if winner}
        <div class="winner-banner dumbledore-font {winner}">{#if when}<div class="winner-when">{when}</div>{/if}{winner === 'good' ? 'Good' : 'Evil'}<br>wins{#if day}<div class="winner-day">Day {day}</div>{/if}</div>
    {/if}
{/snippet}

<!-- Beside the board's menu button -->
{#snippet sidebarTop()}
    <button class="sidebar-btn" disabled={exporting} onclick={saveAsPng} title={exporting ? 'Saving…' : 'Save as PNG'} aria-label="Save as PNG">
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={photoCameraIcon}/></svg>
    </button>
    <button class="sidebar-btn" onclick={() => board?.fitView()} title="Fit to screen" aria-label="Fit to screen">
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={fitScreenIcon}/></svg>
    </button>
    <button class="sidebar-btn" disabled={!changed} onclick={reset} title="Reset to as it was saved" aria-label="Reset to as it was saved">
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={restartAltIcon}/></svg>
    </button>
    {#if statsHref}
    <button class="sidebar-btn" onclick={openStats} title="Timing stats" aria-label="Timing stats">
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={barChartIcon}/></svg>
    </button>
    {/if}
{/snippet}

<!-- In the top right corner, as the sidebar is in the top left; under the token tray, as the board's own buttons are -->
{#snippet topRight()}
    <button class="sidebar-btn close-btn" class:drag-hidden={dragging} style="z-index: {GRIM_Z.ui};" onclick={onclose} title="Close" aria-label="Close">
        <svg viewBox={ICON_VIEWBOX} fill="currentColor"><path d={closeIcon}/></svg>
    </button>
{/snippet}

<svelte:window {onkeydown} />

<!-- Not a dialog role: the board treats anything in one as outside it (see GrimBoard) -->
<section class="snapshot-overlay grim-ui" aria-label={title}>
    <div class="snapshot-body">
        <div class="snapshot-bg" aria-hidden="true"></div>
        <GrimBoard
            bind:this={board}
            {model}
            {undo}
            bind:dragging
            ignoreGesturesOn=".close-btn"
            centre={winnerBanner}
            {sidebarTop}
            {topRight}
        />
    </div>
</section>


{#if exporting}
    <!-- Hidden behind the overlay while it's captured. -->
    <div class="export-frame" bind:this={exportEl} style="width: {exportBounds.width}px; height: {exportBounds.height}px;">
        <div class="snapshot-bg" aria-hidden="true"></div>
        <canvas class="export-canvas" bind:this={exportCanvas} width={exportBounds.width} height={exportBounds.height}></canvas>
        <div class="export-origin" style="left: {-exportBounds.minX}px; top: {-exportBounds.minY}px;">
            {@render winnerBanner()}
            <GrimPieces {model}/>
        </div>
    </div>
{/if}

<style>
    .export-frame {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 9999;
        overflow: hidden;
        background: var(--theme-bg);
        color: var(--theme-on-bg);
        pointer-events: none;
    }
    /* The town's backdrop, blurred and dimmed so the tokens stand out. Overscaled so the blur's soft edges are cropped. */
    .snapshot-bg {
        position: absolute;
        inset: -40px;
        background: url('/botc-official-bg.webp') center / cover no-repeat;
        filter: brightness(0.35);
        pointer-events: none;
    }

    .export-canvas {
        position: absolute;
        inset: 0;
        z-index: 10;
    }
    .export-origin {
        position: absolute;
        width: 0;
        height: 0;
    }

    .snapshot-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        background: var(--theme-bg);
        color: var(--theme-on-bg);
    }

    .snapshot-body {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        touch-action: none;
        /* The undo button sits just left of the Close button */
        --grim-undo-right: 60px;
        --grim-undo-top: 8px;
    }

    .close-btn {
        position: absolute;
        top: 8px;
        right: 8px;
    }

    .winner-banner {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        /* In front of the drawings (10), tokens (15-20) and reminders (30). */
        z-index: 40;
        font-size: 120px;
        font-weight: 700;
        white-space: nowrap;
        text-align: center;
        line-height: 1;
        user-select: none;
        pointer-events: none;
        text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    }
    .winner-day {
        margin-top: 0.3em;
        font-size: 48px;
        color: var(--theme-on-bg);
    }
    .winner-when {
        margin-bottom: 0.4em;
        font-family: system-ui, sans-serif;
        font-size: 30px;
        font-weight: normal;
        color: var(--theme-on-bg);
        opacity: 0.8;
    }
    .winner-banner.good {
        color: #558bdf;
    }
    .winner-banner.evil {
        color: #ca4444;
    }
</style>
