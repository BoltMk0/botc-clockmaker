<script lang="ts">
    import { browser } from '$app/environment';
    import PenIcon from '$lib/assets/PenIcon.svelte';
    import RubberIcon from '$lib/assets/RubberIcon.svelte';
    import { onDestroy, onMount } from 'svelte';

    type Point = { x: number; y: number };
    type Tool = 'pen' | 'eraser';
    type Stroke = { points: Point[]; color: string; width: number; tool: Tool };

    
    let tool: Tool = 'pen';
    let activePen: 1 | 2 = 1;
    let editMode = false;

    function toggleEditMode() {
        editMode = !editMode;
        if (!editMode) {
            // Exiting edit mode: save, reset view, stop any in-progress interaction.
            saveDrawing();
            cancelAutosave();
            cancelPendingTouch();
            drawing = false;
            currentStroke = null;
            activePointerId = null;
            activePointers.clear();
            touchScreenPos.clear();
            pinchPrevMid = null;
            viewScale = 1;
            viewTx = 0;
            viewTy = 0;
            redrawFromStrokes();
        }
    }
    let pen1Color = '#ff4030';
    let pen2Color = '#5080ff';
    let penWidth = 2;
    let eraserWidth = 30;

    function getActivePenColor() {
        return activePen === 1 ? pen1Color : pen2Color;
    }

    function setActivePenColor(nextColor: string) {
        if (activePen === 1) pen1Color = nextColor;
        else pen2Color = nextColor;
    }

    function getReadableTextColor(backgroundHex: string) {
        // backgroundHex: #rrggbb
        const hex = backgroundHex.startsWith('#') ? backgroundHex.slice(1) : backgroundHex;
        if (hex.length !== 6) return '#fff';
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);

        // Relative luminance approximation (0..255)
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance > 140 ? '#000' : '#fff';
    }

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    let drawing = false;
    let activePointerId: number | null = null;
    const activePointers = new Set<number>();

    let pendingTouch:
        | {
                pointerId: number;
                start: Point;
                timeoutId: number;
          }
        | null = null;

    const strokes: Stroke[] = [];
    let currentStroke: Stroke | null = null;

    // View transform: strokes are stored in world space; the canvas applies pan + zoom.
    export let viewScale = 1;
    export let viewTx = 0;
    export let viewTy = 0;
    const MIN_SCALE = 0.2;
    const MAX_SCALE = 10;

    // Per-touch pointer screen-space positions (CSS px relative to canvas rect) for pinch.
    const touchScreenPos = new Map<number, Point>();
    let pinchPrevMid: Point | null = null;
    let pinchPrevDist = 1;

    const STORAGE_KEY = 'botct-annotations:test-canvas:v1';
    const COLORS_KEY = 'botct-annotations:test-colors:v1';
    const AUTOSAVE_IDLE_MS = 1000;
    let autosaveTimeoutId: number | null = null;
    let isSaved = true;

    function isTool(value: unknown): value is Tool {
        return value === 'pen' || value === 'eraser';
    }

    function isPoint(value: unknown): value is Point {
        if (!value || typeof value !== 'object') return false;
        const point = value as { x?: unknown; y?: unknown };
        return typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y);
    }

    function loadDrawing() {
        if (!browser || typeof window === 'undefined') return;
        console.log('Loading drawing from localStorage...');

        // Load pen colors first.
        try {
            const rawColors = window.localStorage.getItem(COLORS_KEY);
            if (rawColors) {
                const parsed = JSON.parse(rawColors) as unknown;
                if (parsed && typeof parsed === 'object') {
                    const c = parsed as Record<string, unknown>;
                    if (typeof c.pen1Color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.pen1Color)) pen1Color = c.pen1Color;
                    if (typeof c.pen2Color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.pen2Color)) pen2Color = c.pen2Color;
                }
            }
        } catch {
            // Ignore corrupt saved colors.
        }
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                console.log('No saved drawing found.');
                return;
            };
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) {
                console.warn('Saved drawing is not an array, ignoring.');
                return;
            };

            const loaded: Stroke[] = [];
            for (const item of parsed) {
                if (!item || typeof item !== 'object') continue;
                const candidate = item as Partial<Stroke>;
                if (!isTool(candidate.tool)) continue;
                if (!Array.isArray(candidate.points) || candidate.points.length === 0) continue;
                if (typeof candidate.width !== 'number' || !Number.isFinite(candidate.width) || candidate.width <= 0) continue;
                if (typeof candidate.color !== 'string') continue;

                const points = candidate.points.filter(isPoint);
                if (points.length === 0) continue;

                loaded.push({
                    tool: candidate.tool,
                    width: candidate.width,
                    color: candidate.color,
                    points
                });
            }

            console.log(`Loaded ${loaded.length} valid strokes from saved drawing.`);

            strokes.splice(0, strokes.length, ...loaded);
            isSaved = true;
        } catch {
            // Ignore corrupt/unparseable saved data.
        }
    }

    function saveDrawing() {
        if (!browser || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(strokes));
            window.localStorage.setItem(COLORS_KEY, JSON.stringify({ pen1Color, pen2Color }));
            isSaved = true;
        } catch {
            // Ignore quota / private-mode failures.
        }
    }

    function scheduleAutosave() {
        if (!browser || typeof window === 'undefined') return;
        isSaved = false;
        if (autosaveTimeoutId !== null) {
            window.clearTimeout(autosaveTimeoutId);
        }
        autosaveTimeoutId = window.setTimeout(() => {
            autosaveTimeoutId = null;
            saveDrawing();
        }, AUTOSAVE_IDLE_MS);
    }

    function cancelAutosave() {
        if (!browser || typeof window === 'undefined') {
            autosaveTimeoutId = null;
            return;
        }
        if (autosaveTimeoutId !== null) {
            window.clearTimeout(autosaveTimeoutId);
            autosaveTimeoutId = null;
        }
    }

    function applyStrokeStyle(targetCtx: CanvasRenderingContext2D, stroke: Stroke) {
        targetCtx.lineWidth = stroke.width;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';

        if (stroke.tool === 'eraser') {
            targetCtx.globalCompositeOperation = 'destination-out';
            targetCtx.strokeStyle = '#000000';
        } else {
            targetCtx.globalCompositeOperation = 'source-over';
            targetCtx.strokeStyle = stroke.color;
        }
    }

    function drawDot(point: Point, stroke: Stroke) {
        if (!ctx) return;
        ctx.save();
        applyStrokeStyle(ctx, stroke);
        ctx.fillStyle = stroke.tool === 'eraser' ? '#000000' : stroke.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawSegment(from: Point, to: Point, stroke: Stroke) {
        if (!ctx) return;
        ctx.save();
        applyStrokeStyle(ctx, stroke);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
    }

    function cancelPendingTouch() {
        if (pendingTouch && typeof window !== 'undefined') {
            window.clearTimeout(pendingTouch.timeoutId);
        }
        pendingTouch = null;
    }

    function beginStroke(pointerId: number, start: Point, isTouch = false) {
        if (!ctx) return;
        cancelPendingTouch();

        activePointerId = pointerId;
        // Don't capture touch pointers — let the browser handle multi-touch
        // gestures (pinch-zoom, pan) freely. Mouse/pen are captured for reliable
        // out-of-canvas tracking.
        if (!isTouch) {
            canvas.setPointerCapture(pointerId);
        }
        drawing = true;

        currentStroke = {
            points: [start],
            color: tool === 'pen' ? getActivePenColor() : '#000000',
            width: tool === 'eraser' ? eraserWidth : penWidth,
            tool
        };
        strokes.push(currentStroke);
        scheduleAutosave();
    }

    function getScreenPos(event: PointerEvent): Point {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function screenToWorld(p: Point): Point {
        return { x: (p.x - viewTx) / viewScale, y: (p.y - viewTy) / viewScale };
    }

    // Returns pointer position in world space (stroke coordinates).
    function getPos(event: PointerEvent): Point {
        return screenToWorld(getScreenPos(event));
    }

    function resizeCanvasAndRedraw() {
        if (!canvas || !ctx) return;
        // This function may be invoked from callbacks; make it SSR-safe.
        if (typeof window === 'undefined') return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        // Size the backing store to match the displayed size (in CSS px) * DPR.
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));

        // Resizing the canvas backing store clears it and resets the transform.
        // Re-apply the view transform so strokes render at the correct pan/zoom.
        ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, viewTx * dpr, viewTy * dpr);
        replayStrokes();
    }

    function resetView() {
        viewScale = 1;
        viewTx = 0;
        viewTy = 0;
        redrawFromStrokes();
    }

    function clearDrawing() {
        strokes.splice(0, strokes.length);
        currentStroke = null;
        drawing = false;

        if (ctx && canvas && typeof window !== 'undefined') {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        scheduleAutosave();
    }

    function redrawFromStrokes() {
        if (!ctx || !canvas) return;
        if (typeof window === 'undefined') return;

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        // Clear in device-pixel space (ignores any current transform).
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        // Apply view transform before replaying strokes.
        ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, viewTx * dpr, viewTy * dpr);
        replayStrokes();
    }

    function undoLastStroke() {
        if (strokes.length === 0) return;

        // If a stroke is currently in progress, cancel it.
        cancelPendingTouch();
        if (activePointerId !== null) {
            try {
                canvas.releasePointerCapture(activePointerId);
            } catch {
                // Ignore if capture was already released.
            }
        }
        drawing = false;
        currentStroke = null;
        activePointerId = null;
        activePointers.clear();
        touchScreenPos.clear();
        pinchPrevMid = null;

        strokes.pop();
        redrawFromStrokes();
        scheduleAutosave();
    }

    function replayStrokes() {
        if (!ctx) return;
        for (const stroke of strokes) {
            drawStroke(stroke);
        }
    }

    function drawStroke(stroke: Stroke) {
        if (!ctx) return;
        if (stroke.points.length === 0) return;

        ctx.save();
        applyStrokeStyle(ctx, stroke);

        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let index = 1; index < stroke.points.length; index += 1) {
            ctx.lineTo(stroke.points[index].x, stroke.points[index].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function onPointerDown(event: PointerEvent) {
        if (!ctx || !editMode) return;
        activePointers.add(event.pointerId);

        // Track screen-space position of every touch pointer for pinch detection.
        if (event.pointerType === 'touch') {
            touchScreenPos.set(event.pointerId, getScreenPos(event));
        }

        // If a second touch comes down, abort drawing and initialise pinch state.
        if (activePointers.size > 1) {
            cancelPendingTouch();
            if (activePointerId !== null) {
                try {
                    canvas.releasePointerCapture(activePointerId);
                } catch {
                    // Ignore if capture was already released.
                }
            }
            drawing = false;
            currentStroke = null;
            activePointerId = null;

            // Bootstrap pinch tracking from the two current pointer positions.
            if (touchScreenPos.size >= 2) {
                const positions = [...touchScreenPos.values()];
                const p1 = positions[0];
                const p2 = positions[1];
                pinchPrevMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                pinchPrevDist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
            }
            return;
        }

        const start = getPos(event);

        // Touch input: defer starting a stroke so an incoming second finger is handled first.
        if (event.pointerType === 'touch') {
            cancelPendingTouch();
            activePointerId = event.pointerId;

            if (typeof window !== 'undefined') {
                const timeoutId = window.setTimeout(() => {
                    // Time elapsed without a second finger — treat as intentional draw start.
                    if (activePointers.size === 1 && activePointerId === event.pointerId) {
                        beginStroke(event.pointerId, start, true);
                        if (currentStroke) {
                            drawDot(start, currentStroke);
                        }
                    }
                }, 80);

                pendingTouch = { pointerId: event.pointerId, start, timeoutId };
            }
            return;
        }

        // Mouse/pen input: start immediately.
        event.preventDefault();
        beginStroke(event.pointerId, start);
        if (currentStroke) {
            drawDot(start, currentStroke);
        }
    }

    function onPointerMove(event: PointerEvent) {
        if (!ctx || !editMode) return;

        // Keep stored screen position current for every touch pointer.
        if (event.pointerType === 'touch') {
            touchScreenPos.set(event.pointerId, getScreenPos(event));
        }

        // Two-finger pinch: derive scale and translation from pointer pair.
        if (activePointers.size >= 2) {
            if (pinchPrevMid !== null && touchScreenPos.size >= 2) {
                const positions = [...touchScreenPos.values()];
                const p1 = positions[0];
                const p2 = positions[1];
                const newMid: Point = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const newDist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));

                // Compute new scale, clamped to [MIN_SCALE, MAX_SCALE].
                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewScale * newDist / pinchPrevDist));
                const actualF = newScale / viewScale;

                // Keep the world point under the previous midpoint aligned under the new midpoint.
                viewTx = newMid.x - actualF * (pinchPrevMid.x - viewTx);
                viewTy = newMid.y - actualF * (pinchPrevMid.y - viewTy);
                viewScale = newScale;

                pinchPrevMid = newMid;
                pinchPrevDist = newDist;

                redrawFromStrokes();
            }
            return;
        }

        // If we have a pending touch stroke, only start drawing after a small move threshold.
        if (!drawing && pendingTouch && pendingTouch.pointerId === event.pointerId) {
            const next = getPos(event);
            const dx = next.x - pendingTouch.start.x;
            const dy = next.y - pendingTouch.start.y;

            // ~3px threshold before we consider it a draw.
            if (dx * dx + dy * dy < 9) return;

            event.preventDefault();
            beginStroke(event.pointerId, pendingTouch.start, true);
        }

        if (!drawing) return;
        if (activePointerId !== event.pointerId) return;
        if (!currentStroke) return;

        event.preventDefault();
        const next = getPos(event);
        const points = currentStroke.points;
        const prev = points[points.length - 1];
        points.push(next);
        drawSegment(prev, next, currentStroke);
        scheduleAutosave();
    }

    function endStroke(event: PointerEvent) {
        activePointers.delete(event.pointerId);
        touchScreenPos.delete(event.pointerId);
        if (activePointers.size < 2) {
            pinchPrevMid = null;
        }

        // Short tap: finger lifted while still in the pending-touch window.
        // Draw a dot at the original touch position instead of silently discarding.
        if (pendingTouch?.pointerId === event.pointerId) {
            const tapStart = pendingTouch.start;
            cancelPendingTouch();

            // Only draw a dot if no second finger interfered.
            if (activePointers.size === 0) {
                const tapStroke: Stroke = {
                    points: [tapStart],
                    color: tool === 'pen' ? getActivePenColor() : '#000000',
                    width: tool === 'eraser' ? eraserWidth : penWidth,
                    tool
                };
                strokes.push(tapStroke);
                drawDot(tapStart, tapStroke);
                scheduleAutosave();
            }

            activePointerId = null;
            return;
        }

        if (activePointerId !== event.pointerId) return;

        event.preventDefault();
        drawing = false;
        currentStroke = null;
        try {
            canvas.releasePointerCapture(event.pointerId);
        } catch {
            // Ignore if capture was already released.
        }
        activePointerId = null;
    }

    let resizeObserver: ResizeObserver | null = null;

    onMount(() => {
        ctx = canvas.getContext('2d');

        loadDrawing();
        resizeCanvasAndRedraw();

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                resizeCanvasAndRedraw();
            });
            resizeObserver.observe(canvas);
        }

        if (browser && typeof window !== 'undefined') {
            window.addEventListener('resize', resizeCanvasAndRedraw, { passive: true });
        }
    });

    onDestroy(() => {
        cancelPendingTouch();
        cancelAutosave();
        saveDrawing();
        if (browser && typeof window !== 'undefined') {
            window.removeEventListener('resize', resizeCanvasAndRedraw);
        }
        resizeObserver?.disconnect();
    });
</script>


<div class="toolbar" aria-label="Annotation tools">
    <button
        class="button-style tool-button edit-toggle"
        on:click={toggleEditMode}
        aria-label={editMode ? 'Commit' : 'Edit'}
        title={editMode ? 'Commit' : 'Edit'}
    >
        {#if editMode}
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width:100%;height:100%">
                <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
        {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width:100%;height:100%">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
        {/if}
    </button>

    {#if editMode}
    <div class="tool-group">
    <span
        class="save-status"
        aria-live="polite"
        aria-label={isSaved ? 'Saved' : 'Unsaved changes'}
        title={isSaved ? 'Saved' : 'Unsaved changes'}
    >
        {#if isSaved}
            <svg class="save-icon saved" viewBox="0 0 24 24" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm-1.1 14.2L6.7 12l1.4-1.4l2.8 2.8l6.2-6.2l1.4 1.4l-7.6 7.6Z"
                />
            </svg>
        {:else}
            <svg class="save-icon unsaved" viewBox="0 0 24 24" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16a8 8 0 0 1 0 16Z"
                />
            </svg>
        {/if}
    </span>

    <button
        class="button-style tool-button"
        class:highlight={tool === 'pen' && activePen === 1}
        style="border: 2px solid {pen1Color}; background-color: {tool === 'pen' && activePen === 1 ? pen1Color : 'transparent'}; color: {tool === 'pen' && activePen === 1 ? 'currentColor' : pen1Color}"
        on:click={() => {
            tool = 'pen';
            activePen = 1;
        }}
        aria-label="Pen 1"
    >
        <PenIcon color={activePen === 1 && tool === 'pen' ? 'currentColor' : pen1Color} style="width: 100%; height: 100%;" />
        <input
            class="pen-color-input"
            type="color"
            bind:value={pen1Color}
            aria-label="Select pen 1 color"
            tabindex={tool === 'pen' && activePen === 1 ? 0 : -1}
        />
    </button>
    <button
        class="button-style tool-button"
        class:highlight={tool === 'pen' && activePen === 2}
        style="border: 2px solid {pen2Color}; background-color: {tool === 'pen' && activePen === 2 ? pen2Color : 'transparent'}; color: {tool === 'pen' && activePen === 2 ? 'currentColor' : pen2Color}"
        on:click={() => {
            tool = 'pen';
            activePen = 2;
        }}
        aria-label="Pen 2"
    >
        <PenIcon color={activePen === 2 && tool === 'pen' ? 'currentColor' : pen2Color} style="width: 100%; height: 100%;" />
        <input
            class="pen-color-input"
            type="color"
            bind:value={pen2Color}
            aria-label="Select pen 2 color"
            tabindex={tool === 'pen' && activePen === 2 ? 0 : -1}
        />
    </button>
    <button class="button-style tool-button" class:highlight={tool === 'eraser'} on:click={() => (tool = 'eraser')}>
        <RubberIcon color="currentColor" style="width: 100%; height: 100%;" />
    </button>
    <button class="button-style tool-button" on:click={undoLastStroke} aria-label="Undo last stroke">Undo</button>
    <!-- <button class="button-style tool-button" on:click={resetView} aria-label="Reset view">Reset</button> -->
    <button class="button-style tool-button error" on:click={clearDrawing}>Clear</button>
    </div>
    {/if}
</div>

<div class="canvas-wrap" class:inactive={!editMode} aria-hidden={!editMode}>
    <canvas
        bind:this={canvas}
        class:inactive={!editMode}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={endStroke}
        on:pointercancel={endStroke}
        on:pointerleave={endStroke}
        on:pointerout={endStroke}
    ></canvas>
</div>

<style>
    .canvas-wrap {
        position: absolute;
        inset: 0;
    }

    canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        /* touch-action: none — all touch gestures are handled in JS (pinch-zoom,
           pan, draw). Without this the browser claims the pinch-zoom gesture after
           a short delay, fires pointercancel on both pointers, and kills tracking. */
        touch-action: none;
    }

    canvas.inactive, .canvas-wrap.inactive {
        pointer-events: none;
    }

    .toolbar {
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 10;
        display: flex;
        gap: 8px;
        align-items: center;
        padding: 8px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--theme-bg-secondary) 85%, transparent);
        backdrop-filter: blur(4px);
    }

    .tool-group {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .save-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
    }

    .save-icon {
        width: 22px;
        height: 22px;
    }

    .save-icon.saved {
        color: var(--theme-slider-accent);
    }

    .save-icon.unsaved {
        color: var(--theme-on-bg-secondary);
    }

    .tool-button {
        position: relative;
        height: 2.5em;
        width: 2.5em;
        padding: 4px;
    }

    .pen-color-input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        padding: 0;
        border: 0;
        opacity: 0;
        pointer-events: none;
    }

    .tool-button.highlight .pen-color-input {
        pointer-events: auto;
    }
</style>