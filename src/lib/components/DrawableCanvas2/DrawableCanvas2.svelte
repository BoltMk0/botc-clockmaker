<script lang="ts">
    import { browser } from '$app/environment';
    import { onDestroy, onMount } from 'svelte';
    import { type CanvasLayer, type CanvasPoint, type CanvasStroke, type CanvasToolType } from './types';

    const MIN_SCALE = 0.2;
    const MAX_SCALE = 10;

    interface Props {
        canvasStyle?: string;
        exportedDimensions?: { width: number; height: number };
        onchange?: () => void;
        activeLayerIndex: number;
        layers: CanvasLayer[];
        tool: CanvasToolType | null;
        viewScale: number;
        viewTx: number;
        viewTy: number;
    };

    let {
        canvasStyle,
        exportedDimensions,
        onchange,
        activeLayerIndex,
        layers = $bindable<CanvasLayer[]>([]),
        tool = $bindable<CanvasToolType|null>(null),
        viewScale = $bindable<number>(1),
        viewTx = $bindable<number>(0),
        viewTy = $bindable<number>(0),
    }: Props = $props();



    /////// INTERNAL VARIABLES /////////
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    let drawing = false;
    let activePointerId: number | null = null;
    const activePointers = new Set<number>();

    let pendingTouch:
        | {
                pointerId: number;
                start: {x: number; y: number};
                timeoutId: number;
          }
        | null = null;

    let currentStroke = $state<CanvasStroke | null>(null);

    

    // Per-touch pointer screen-space positions (CSS px relative to canvas rect) for pinch.
    const touchScreenPos = new Map<number, {x: number; y: number}>();
    let pinchPrevMid: {x: number; y: number} | null = null;
    let pinchPrevDist = 1;

    // Two-finger tap detection for undo.
    let twoFingerStart: number = 0;
    let twoFingerMoved: boolean = false;
    const TWO_FINGER_TAP_MAX_MS = 300;
    const TWO_FINGER_TAP_MOVE_THRESHOLD = 15;

    // Internal canvas center offset — added to viewTx/viewTy for the actual screen translation.
    // Keeps exported viewTx/viewTy center-relative (0,0 = no pan).
    let canvasCenterX = 0;
    let canvasCenterY = 0;




    ////// EFFECTS /////
    // Redraw canvas when layers is updated
    $effect(()=>{
        layers; // Triggers when layers updates
        activeLayerIndex; // And when active layer changes, since we draw it with full opacity and others faded.
        viewTx; viewTy; viewScale; // tracked as reactive dependencies
        redrawFromStrokes();
    });

    // Reset view when tool is set to null (e.g. after finishing editing).
    $effect(()=>{if(tool === null) {viewScale = 1; viewTx = 0; viewTy = 0;}}); // Reset zoom and pan when no tool is active.







    ////// DERIVED //////
    const activeLayer = $derived(activeLayerIndex < 0 || activeLayerIndex >= layers.length ? null : layers[activeLayerIndex]);




    export async function saveCanvasAsBlob(): Promise<Blob | null> {
        if (!canvas) return null;
        console.debug("Saving canvas as blob...");
        if (!exportedDimensions) {
            return new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob));
            });
        }

        // Render strokes into an offscreen canvas cropped to exportedDimensions.
        // World (0,0) is at the center of the export region, scale 1.
        const { width, height } = exportedDimensions;
        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return null;
        offCtx.setTransform(1, 0, 0, 1, width / 2, height / 2);
        for (const layer of layers) {
            for (const stroke of layer.strokes) {
                drawStrokeOnCtx(offCtx, stroke);
            }
        }
        return new Promise<Blob | null>((resolve) => {
            offscreen.toBlob((blob) => resolve(blob));
        });
    }



    function applyStrokeStyle(targetCtx: CanvasRenderingContext2D, stroke: CanvasStroke) {
        targetCtx.lineWidth = stroke.tool.width;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';

        switch(stroke.tool.type){
            case 'pen':
                targetCtx.globalCompositeOperation = 'source-over';
                targetCtx.strokeStyle = stroke.tool.color;
                break;
            case 'eraser':
                targetCtx.globalCompositeOperation = 'destination-out';
                targetCtx.strokeStyle = '#000000';
                break;
            default:
                throw new Error(`Unknown tool type: ${(stroke.tool as any).type}`);
        }
    }

    function drawDot(point: CanvasPoint, stroke: CanvasStroke) {
        if (!ctx) return;
        ctx.save();
        applyStrokeStyle(ctx, stroke);
        ctx.fillStyle = stroke.tool.type === 'eraser' ? '#000000' : stroke.tool.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, stroke.tool.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawSegment(from: CanvasPoint, to: CanvasPoint, stroke: CanvasStroke) {
        if (!ctx) return;
        ctx.save();
        applyStrokeStyle(ctx, stroke);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
    }

    // Returns squared distance from point p to the closest point on segment a→b.
    function pointToSegmentDistSq(p: CanvasPoint, a: CanvasPoint, b: CanvasPoint): number {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) { const ex = p.x - a.x, ey = p.y - a.y; return ex * ex + ey * ey; }
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        const cx = a.x + t * dx - p.x, cy = a.y + t * dy - p.y;
        return cx * cx + cy * cy;
    }

    // Returns true if any part of stroke comes within (eraserRadius + stroke.width/2) of the eraser segment.
    function strokeHitsEraser(stroke: CanvasStroke, eraserFrom: CanvasPoint, eraserTo: CanvasPoint, eraserRadius: number): boolean {
        const threshold = eraserRadius + stroke.tool.width / 2;
        const threshSq = threshold * threshold;
        if (stroke.points.length === 1) {
            return pointToSegmentDistSq(stroke.points[0], eraserFrom, eraserTo) <= threshSq;
        }
        // Check every stroke vertex against the eraser segment.
        for (const pt of stroke.points) {
            if (pointToSegmentDistSq(pt, eraserFrom, eraserTo) <= threshSq) return true;
        }
        // Check both eraser endpoints against every stroke segment (catches fast crossings).
        for (let i = 1; i < stroke.points.length; i++) {
            if (pointToSegmentDistSq(eraserFrom, stroke.points[i - 1], stroke.points[i]) <= threshSq) return true;
            if (pointToSegmentDistSq(eraserTo, stroke.points[i - 1], stroke.points[i]) <= threshSq) return true;
        }
        return false;
    }

    function eraseAlongPath(from: CanvasPoint, to: CanvasPoint, eraserWidth: number) {
        if(!activeLayer) return;
        const radius = eraserWidth / 2;
        let erased = false;
        for (let i = activeLayer.strokes.length - 1; i >= 0; i--) {
            if (strokeHitsEraser(activeLayer.strokes[i], from, to, radius)) {
                activeLayer.strokes.splice(i, 1);
                erased = true;
            }
        }
        if (erased) {
            redrawFromStrokes();
            onchange?.();
        }
    }

    function cancelPendingTouch() {
        if (pendingTouch && typeof window !== 'undefined') {
            window.clearTimeout(pendingTouch.timeoutId);
        }
        pendingTouch = null;
    }

    function beginStroke(pointerId: number, start: CanvasPoint, isTouch = false) {
        if (!ctx) return;
        if(!tool) return;
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
            tool
        };

        // Eraser strokes are not stored — they remove other strokes via hit-testing.
        if (tool?.type !== 'eraser') {
            if(!activeLayer) return;
            activeLayer.strokes.push(currentStroke);
            onchange?.();
        }
    }

    function getScreenPos(event: PointerEvent): CanvasPoint {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function screenToWorld(p: CanvasPoint): CanvasPoint {
        return { x: (p.x - (viewTx + canvasCenterX)) / viewScale, y: (p.y - (viewTy + canvasCenterY)) / viewScale };
    }

    // Returns pointer position in world space (stroke coordinates).
    function getPos(event: PointerEvent): CanvasPoint {
        return screenToWorld(getScreenPos(event));
    }

    function resizeCanvasAndRedraw() {
        if (!canvas || !ctx) return;
        if (typeof window === 'undefined') return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        canvasCenterX = rect.width / 2;
        canvasCenterY = rect.height / 2;

        const tx = viewTx + canvasCenterX;
        const ty = viewTy + canvasCenterY;

        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));

        ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, tx * dpr, ty * dpr);
        replayStrokes();
    }

    function resetView() {
        console.debug("Resetting view...");
        viewScale = 1;
        viewTx = 0;
        viewTy = 0;
        redrawFromStrokes();
    }

    function clearDrawing() {
        console.debug("Clearing drawing...");
        if(!activeLayer) return;
        activeLayer.strokes.splice(0, activeLayer.strokes.length);
        currentStroke = null;
        drawing = false;

        if (ctx && canvas && typeof window !== 'undefined') {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        onchange?.();
    }

    function redrawFromStrokes() {
        if (!ctx || !canvas) return;
        if (typeof window === 'undefined') return;

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const tx = viewTx + canvasCenterX;
        const ty = viewTy + canvasCenterY;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, tx * dpr, ty * dpr);
        replayStrokes();
    }

    let rafPending = false;
    function scheduleRedraw() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            redrawFromStrokes();
        });
    }

    function undoLastStroke() {
        if(!activeLayer) return;
        if (activeLayer.strokes.length === 0) return;
        console.debug("Undoing last stroke...");

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

        activeLayer.strokes.pop();
        redrawFromStrokes();
        onchange?.();
    }

    function replayStrokes() {
        if (!ctx) return;
        for (let i = 0; i < layers.length; i++) {
            ctx.save();
            ctx.globalAlpha = i === activeLayerIndex ? 1 : 0.6;
            for (const stroke of layers[i].strokes) {
                drawStroke(stroke);
            }
            ctx.restore();
        }
    }

    function drawStrokeOnCtx(targetCtx: CanvasRenderingContext2D, stroke: CanvasStroke) {
        if (stroke.points.length === 0) return;
        console.debug(`Drawing stroke with ${stroke.points.length} points, tool=${JSON.stringify(stroke.tool)}...`);
        targetCtx.save();
        applyStrokeStyle(targetCtx, stroke);
        if (stroke.points.length === 1) {
            targetCtx.fillStyle = stroke.tool.type === 'eraser' ? '#000000' : stroke.tool.color;
            targetCtx.beginPath();
            targetCtx.arc(stroke.points[0].x, stroke.points[0].y, stroke.tool.width / 2, 0, Math.PI * 2);
            targetCtx.fill();
        } else {
            targetCtx.beginPath();
            targetCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let index = 1; index < stroke.points.length; index += 1) {
                targetCtx.lineTo(stroke.points[index].x, stroke.points[index].y);
            }
            targetCtx.stroke();
        }
        targetCtx.restore();
    }

    function drawStroke(stroke: CanvasStroke) {
        if (!ctx) return;
        drawStrokeOnCtx(ctx, stroke);
    }

    function onPointerDown(event: PointerEvent) {
        if (!ctx || tool === null) return;
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
                twoFingerStart = Date.now();
                twoFingerMoved = false;
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
        if (!ctx || tool === null) return;

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
                const newMid: CanvasPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const newDist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));

                // Compute new scale, clamped to [MIN_SCALE, MAX_SCALE].
                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, viewScale * newDist / pinchPrevDist));
                const actualF = newScale / viewScale;

                // Keep the world point under the previous midpoint aligned under the new midpoint.
                // viewTx/viewTy are center-relative, so convert to/from screen space via canvasCenter.
                const screenTx = viewTx + canvasCenterX;
                const screenTy = viewTy + canvasCenterY;
                viewTx = newMid.x - actualF * (pinchPrevMid.x - screenTx) - canvasCenterX;
                viewTy = newMid.y - actualF * (pinchPrevMid.y - screenTy) - canvasCenterY;
                viewScale = newScale;

                // Mark as moved if midpoint shifted enough.
                if (!twoFingerMoved) {
                    const dx = newMid.x - pinchPrevMid.x;
                    const dy = newMid.y - pinchPrevMid.y;
                    const distRatio = newDist / pinchPrevDist;
                    if (dx * dx + dy * dy > TWO_FINGER_TAP_MOVE_THRESHOLD * TWO_FINGER_TAP_MOVE_THRESHOLD
                        || distRatio < 0.9 || distRatio > 1.1) {
                        twoFingerMoved = true;
                    }
                }

                pinchPrevMid = newMid;
                pinchPrevDist = newDist;

                scheduleRedraw();
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
        if (currentStroke.tool.type === 'eraser') {
            eraseAlongPath(prev, next, currentStroke.tool.width);
        } else {
            drawSegment(prev, next, currentStroke);
            onchange?.();
        }
    }

    function endStroke(event: PointerEvent) {
        activePointers.delete(event.pointerId);
        touchScreenPos.delete(event.pointerId);
        if (activePointers.size < 2) {
            // Detect two-finger tap: both fingers lifted quickly without moving.
            if (pinchPrevMid !== null && !twoFingerMoved && (Date.now() - twoFingerStart) < TWO_FINGER_TAP_MAX_MS) {
                pinchPrevMid = null;
                undoLastStroke();
                return;
            }
            pinchPrevMid = null;
        }

        // Short tap: finger lifted while still in the pending-touch window.
        // Draw a dot at the original touch position instead of silently discarding.
        if (pendingTouch?.pointerId === event.pointerId) {
            const tapStart = pendingTouch.start;
            cancelPendingTouch();

            // Only draw a dot if no second finger interfered.
            if (activePointers.size === 0) {
                switch(tool?.type) {
                    case 'eraser':
                        eraseAlongPath(tapStart, tapStart, tool.width);
                        break;
                    case 'pen':
                        const tapStroke: CanvasStroke = {
                            points: [tapStart],
                            tool
                        };
                        if(!activeLayer) return;
                        activeLayer.strokes.push(tapStroke);
                        drawDot(tapStart, tapStroke);
                        onchange?.();
                        break;
                    default:
                        break;
                }
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


    let exportBoxStyle = $derived(exportedDimensions
        ? `left:${(-exportedDimensions.width / 2) * viewScale + viewTx + canvasCenterX}px; top:${(-exportedDimensions.height / 2) * viewScale + viewTy + canvasCenterY}px; width:${exportedDimensions.width * viewScale}px; height:${exportedDimensions.height * viewScale}px;`
        : '');

    let resizeObserver: ResizeObserver | null = null;

    onMount(() => {
        ctx = canvas.getContext('2d');

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
        if (browser && typeof window !== 'undefined') {
            window.removeEventListener('resize', resizeCanvasAndRedraw);
        }
        resizeObserver?.disconnect();
    });
</script>

<div class="canvas-wrapper"
    aria-hidden="{tool === null}"
    class:inactive={tool === null}
    style="{canvasStyle}"
    >
    {#if exportedDimensions}
        <div class="export-box" style={exportBoxStyle} aria-hidden="true"></div>
    {/if}
    <canvas
        bind:this={canvas}
        class:inactive={tool === null}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={endStroke}
        on:pointercancel={endStroke}
        on:pointerleave={endStroke}
        on:pointerout={endStroke}
        aria-hidden="{tool === null}"
    ></canvas>
</div>

<style>

    .canvas-wrapper {
        position: absolute;
        inset: 0;
    }
    
    canvas {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        /* background: green; */
        overflow: hidden;
        /* touch-action: none — all touch gestures are handled in JS (pinch-zoom,
           pan, draw). Without this the browser claims the pinch-zoom gesture after
           a short delay, fires pointercancel on both pointers, and kills tracking. */
        touch-action: none;
    }

    .inactive {
        pointer-events: none;
    }

    .export-box {
        position: absolute;
        box-sizing: border-box;
        border: 2px solid red;
        pointer-events: none;
        z-index: 1;
    }

    .toolbar {
        position: absolute;
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

    .layer-dropdown-wrapper {
        position: relative;
    }

    .layer-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        min-width: 150px;
        background: var(--theme-bg-secondary, #2a2a2a);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 20;
        overflow: hidden;
    }

    .layer-item {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .layer-item.active {
        background: color-mix(in srgb, var(--theme-slider-accent, #5080ff) 25%, transparent);
    }

    .layer-select-btn {
        flex: 1;
        text-align: left;
        padding: 6px 10px;
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 0.85em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .layer-select-btn:hover {
        background: color-mix(in srgb, var(--theme-on-bg-secondary, #fff) 10%, transparent);
    }

    .layer-delete-btn {
        flex-shrink: 0;
        padding: 4px 8px;
        background: none;
        border: none;
        color: var(--theme-on-bg-secondary, #aaa);
        cursor: pointer;
        font-size: 1em;
        line-height: 1;
    }

    .layer-delete-btn:hover {
        color: #ff4444;
    }

    .layer-add-btn {
        width: 100%;
        padding: 6px 10px;
        background: none;
        border: none;
        border-top: 1px solid color-mix(in srgb, var(--theme-on-bg-secondary, #fff) 15%, transparent);
        color: var(--theme-slider-accent, #5080ff);
        cursor: pointer;
        font-size: 0.85em;
        text-align: left;
    }

    .layer-add-btn:hover {
        background: color-mix(in srgb, var(--theme-on-bg-secondary, #fff) 10%, transparent);
    }
</style>
