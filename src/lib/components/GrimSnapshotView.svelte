<script lang="ts">
    import { onMount, tick } from "svelte";
    import { domToPng } from "modern-screenshot";
    import AnotatableViewV2 from "$lib/components/DrawableCanvas2/AnotatableViewV2.svelte";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import PlayerToken from "$lib/components/PlayerToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import { alignmentForCategory, type Character, type CharacterCategory, type ReminderToken } from "$lib/resources/common/gameData.js";
    import { ALIGNMENT_RING_FACTORS, BOARD_TOKEN_SIZE, hasDeadVote, isPlayerToken, type GrimoireStateSnapshot, type PlacedToken } from "$lib/resources/common/grimoireState.js";
    import { fetchAllCharacters } from "$lib/resources/client/scriptWithSideCharacters.js";

    // A read-only view of a grim as it was saved: its tokens, reminders and drawings, laid out as on the grim page,
    // which can be panned and zoomed but not changed. Shown over the whole page.

    let { snapshot, title, filename = 'grim', winner, when, day, characters = new Map(), onclose }: {
        snapshot: GrimoireStateSnapshot;
        title: string;
        /** The saved PNG's name, without the extension. */
        filename?: string;
        /** Shown large in the middle of the town, when the game's result is known. */
        winner?: 'good' | 'evil';
        /** Small text under the winner, e.g. when the game ended. */
        when?: string;
        /** The in-game day the game ended on, shown under the winner. */
        day?: number;
        /** Characters already to hand (e.g. the script's); the rest are looked up from the library. */
        characters?: ReadonlyMap<string, Character>;
        onclose: () => void;
    } = $props();

    const tokenSize = BOARD_TOKEN_SIZE;
    const reminderTokenSize = Math.round(tokenSize * 0.56);
    const FIT_PADDING = 8;
    const FIT_MAX_SCALE = 4;

    let library = $state<Character[]>([]);
    const characterById = $derived(new Map<string, Character>([...library.map(c => [c.id, c] as const), ...characters]));

    // The grim also offers a blank reminder (just the character's icon) for every character.
    const reminderById = $derived(new Map<string, ReminderToken & { characterId: string }>([...characterById.values()].flatMap(c => [
        ...c.reminderTokens.map(t => [t.id, { ...t, characterId: c.id }] as const),
        [`blank-${c.id}`, { id: `blank-${c.id}`, text: '', textSize: 100, characterId: c.id }] as const
    ])));

    // Loric and fabled are never players, so they have no alive/dead state or alignment, and don't frame the town.
    const isSideRoleCategory = (category: CharacterCategory | undefined) => category === 'loric' || category === 'fabled';
    const isSideRoleToken = (t: PlacedToken) => isSideRoleCategory(characterById.get(t.characterId ?? '')?.category);

    // The view starts as {layers} and is never drawn on, but the canvas expects its own copy.
    // svelte-ignore state_referenced_locally
    const layers = $state($state.snapshot(snapshot.canvas.layers));

    let viewScale = $state(1);
    let viewTx = $state(0);
    let viewTy = $state(0);
    let boardEl = $state<HTMLElement>();

    // Fits the seated players on screen, centred on the town circle, as the grim page does.
    function fitView() {
        if (!boardEl) return;
        const framed = snapshot.placedTokens.filter(t => isPlayerToken(t) && !isSideRoleToken(t));
        const tokens = framed.length > 0 ? framed : snapshot.placedTokens;
        if (tokens.length === 0) { viewScale = 1; viewTx = 0; viewTy = 0; return; }
        let halfW = 0, halfH = 0;
        for (const t of tokens) {
            halfW = Math.max(halfW, Math.abs(t.x) + tokenSize / 2);
            halfH = Math.max(halfH, Math.abs(t.y) + tokenSize / 2);
        }
        const availW = Math.max(1, boardEl.offsetWidth - FIT_PADDING * 2);
        const availH = Math.max(1, boardEl.offsetHeight - FIT_PADDING * 2);
        viewScale = Math.min(FIT_MAX_SCALE, availW / (halfW * 2), availH / (halfH * 2));
        viewTx = 0;
        viewTy = 0;
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

    const exportBounds = $derived.by(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const include = (x: number, y: number, halfW: number, halfH = halfW) => {
            minX = Math.min(minX, x - halfW); maxX = Math.max(maxX, x + halfW);
            minY = Math.min(minY, y - halfH); maxY = Math.max(maxY, y + halfH);
        };
        for (const t of snapshot.placedTokens) include(t.x, t.y, tokenSize / 2);
        for (const r of snapshot.placedReminders) include(r.x, r.y, reminderTokenSize / 2);
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
        fetchAllCharacters().then(all => library = all);
        fitView();
    });
</script>

<!-- The winner, tokens and reminders, placed around the centre of whatever holds them (which may be 0 wide). -->
{#snippet pieces()}
    {#if winner}
        <div class="winner-banner dumbledore-font {winner}">{#if when}<div class="winner-when">{when}</div>{/if}{winner === 'good' ? 'Good' : 'Evil'}<br>wins{#if day}<div class="winner-day">Day {day}</div>{/if}</div>
    {/if}
    {#each snapshot.placedTokens as token (token.id)}
        {@const character = characterById.get(token.characterId ?? '')}
        {@const sideRole = isSideRoleCategory(character?.category)}
        {#if character || token.characterId === null}
            <div
                class="board-token"
                class:dead={!sideRole && token.isDead}
                class:unnamed={!isPlayerToken(token)}
                class:misaligned={!sideRole && !!character && alignmentForCategory(character.category) !== token.alignment}
                style="left: calc(50% + {token.x}px); top: calc(50% + {token.y}px); z-index: {isPlayerToken(token) ? 20 : 15};"
            >
                {#if character}
                    <CharacterToken {character} style="position: relative;" size="{tokenSize}px" norules
                        dead={sideRole ? false : token.isDead}
                        hasDeadVote={sideRole ? false : hasDeadVote(token)}
                        alignment={sideRole ? undefined : token.alignment}
                        playerName={sideRole ? undefined : (token.playerName?.trim() || undefined)}
                        outline={isPlayerToken(token)}/>
                {:else}
                    <PlayerToken playerName={token.playerName ?? ''} isDead={token.isDead} hasDeadVote={hasDeadVote(token)} style="position: relative;" size="{tokenSize}px"/>
                {/if}
            </div>
        {/if}
    {/each}
    {#each snapshot.placedReminders as reminder}
        {@const reminderToken = reminderById.get(reminder.tokenId)}
        {#if reminderToken}
            <div class="board-reminder" style="left: calc(50% + {reminder.x}px); top: calc(50% + {reminder.y}px);">
                <ReminderTokenView data={reminderToken} characterId={reminderToken.characterId} size="{reminderTokenSize}px"/>
            </div>
        {/if}
    {/each}
{/snippet}

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} onresize={fitView} />

<div class="snapshot-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <div class="snapshot-header">
        <span class="snapshot-title">{title}</span>
        <button class="button-style" onclick={fitView}>Fit</button>
        <button class="button-style" disabled={exporting} onclick={saveAsPng}>{exporting ? 'Saving…' : 'Save as PNG'}</button>
        <button class="button-style" onclick={onclose}>Close</button>
    </div>
    <div class="snapshot-body">
        <div class="snapshot-bg" aria-hidden="true"></div>
        <AnotatableViewV2 tool={null} {layers} activeLayerIndex={0} onresetview={fitView} idleIgnore=".snapshot-header" idlePanIgnore="button" bind:viewScale bind:viewTx bind:viewTy canvasStyle="z-index: 10; pointer-events: none;">
            <div class="board" bind:this={boardEl}>
                {#each ALIGNMENT_RING_FACTORS as factor}
                    <div class="alignment-ring" style="width: {tokenSize * factor * 2}px; height: {tokenSize * factor * 2}px;"></div>
                    <div class="alignment-ring square" style="width: {tokenSize * factor * 2}px; height: {tokenSize * factor * 2}px;"></div>
                {/each}
                {@render pieces()}
            </div>
        </AnotatableViewV2>
    </div>
</div>

{#if exporting}
    <!-- Hidden behind the overlay while it's captured. -->
    <div class="export-frame" bind:this={exportEl} style="width: {exportBounds.width}px; height: {exportBounds.height}px;">
        <div class="snapshot-bg" aria-hidden="true"></div>
        <canvas class="export-canvas" bind:this={exportCanvas} width={exportBounds.width} height={exportBounds.height}></canvas>
        <div class="export-origin" style="left: {-exportBounds.minX}px; top: {-exportBounds.minY}px;">
            {@render pieces()}
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

    .snapshot-header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.6em 1em;
        border-bottom: 1px solid var(--theme-bg-tertiary);
    }

    .snapshot-title {
        flex: 1;
        min-width: 0;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .snapshot-body {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        touch-action: none;
    }

    .board {
        position: absolute;
        inset: 0;
    }

    .alignment-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.01);
        box-sizing: border-box;
        pointer-events: none;
        z-index: 9;
    }
    .alignment-ring.square {
        border-radius: 0;
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

    .board-token,
    .board-reminder {
        position: absolute;
        transform: translate(-50%, -50%);
        user-select: none;
    }
    .board-reminder {
        z-index: 30;
    }

    /* Character tokens with no player name are only reminders, so they sit back a little. */
    .board-token.unnamed {
        opacity: 0.8;
    }
    .board-token.dead :global(img:not(.dead-vote-icon)) {
        filter: grayscale(0.7) brightness(0.6);
    }
    .board-token.misaligned :global(img:not(.dead-vote-icon)) {
        filter: hue-rotate(180deg);
    }
    .board-token.misaligned.dead :global(img:not(.dead-vote-icon)) {
        filter: grayscale(0.7) brightness(0.9) hue-rotate(180deg);
    }
</style>
