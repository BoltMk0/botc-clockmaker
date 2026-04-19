<script lang="ts">
    import { browser } from '$app/environment';
    import PenIcon from '$lib/components/PenIcon.svelte';
    import RubberIcon from '$lib/components/RubberIcon.svelte';
    import { onDestroy, onMount } from 'svelte';

    export let editing = false;
    export let noeditbutton: boolean = false;
    export let canvasStyle: string = '';
    export let strokeWidth = 2;
    export let exportedDimensions: { width: number; height: number } | null = null;
    export let remember: boolean = false;

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

    let penColors = ['#ff4030', '#5080ff', '#ffffff', '#000000'];
    let eraserWidth = 2 * strokeWidth;

    type Point = { x: number; y: number };
    type Tool = 'pen' | 'eraser';
    type Stroke = { points: Point[]; color: string; width: number; tool: Tool };
    type Layer = { name: string; strokes: Stroke[] };

    let tool: Tool = 'pen';
    let activePenIndex = 0;
    let layers: Layer[] = [{ name: 'Layer 1', strokes: [] }];
    let activeLayerIndex = 0;
    let layerDropdownOpen = false;
    

    

    function toggleEditMode() {
        editing = !editing;
        if (!editing) {
            // Exiting edit mode: save, reset view, stop any in-progress interaction.
            if(remember) saveDrawing();
            cancelAutosave();
            cancelPendingTouch();
            drawing = false;
            currentStroke = null;
            activePointerId = null;
            activePointers.clear();
            touchScreenPos.clear();
            pinchPrevMid = null;
            layerDropdownOpen = false;
            viewScale = 1;
            viewTx = 0;
            viewTy = 0;
            redrawFromStrokes();
        }
    }

    function getActivePenColor() {
        return penColors[activePenIndex] ?? '#000000';
    }

    function setActivePenColor(nextColor: string) {
        penColors[activePenIndex] = nextColor;
        penColors = penColors; // trigger reactivity
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

    function getActiveStrokes(): Stroke[] {
        return layers[activeLayerIndex].strokes;
    }
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

    // Two-finger tap detection for undo.
    let twoFingerStart: number = 0;
    let twoFingerMoved: boolean = false;
    const TWO_FINGER_TAP_MAX_MS = 300;
    const TWO_FINGER_TAP_MOVE_THRESHOLD = 15;

    // Internal canvas center offset — added to viewTx/viewTy for the actual screen translation.
    // Keeps exported viewTx/viewTy center-relative (0,0 = no pan).
    let canvasCenterX = 0;
    let canvasCenterY = 0;

    const STORAGE_KEY = 'botct-annotations:test-canvas:v1';
    const COLORS_KEY = 'botct-annotations:test-colors:v1';
    const LAYERS_KEY = 'botct-annotations:test-layers:v1';
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
                let parsed = JSON.parse(rawColors) as unknown;
                if (Array.isArray(parsed)) {
                    let filteredParsed = parsed
                        .filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
                        .slice(0, Math.max(penColors.length, parsed.length));
                    for(let i = 0; i < Math.min(filteredParsed.length, penColors.length); i++) {
                        penColors[i] = filteredParsed[i];
                    }
                }
            }
        } catch {
            // Ignore corrupt saved colors.
        }
        try {
            // Try new layers format first.
            const rawLayers = window.localStorage.getItem(LAYERS_KEY);
            if (rawLayers) {
                const parsedLayers = JSON.parse(rawLayers) as unknown;
                if (Array.isArray(parsedLayers)) {
                    const loadedLayers: Layer[] = [];
                    for (const layerItem of parsedLayers) {
                        if (!layerItem || typeof layerItem !== 'object') continue;
                        const candidate = layerItem as Partial<Layer>;
                        if (typeof candidate.name !== 'string') continue;
                        if (!Array.isArray(candidate.strokes)) continue;
                        const validStrokes: Stroke[] = [];
                        for (const item of candidate.strokes) {
                            if (!item || typeof item !== 'object') continue;
                            const s = item as Partial<Stroke>;
                            if (!isTool(s.tool)) continue;
                            if (!Array.isArray(s.points) || s.points.length === 0) continue;
                            if (typeof s.width !== 'number' || !Number.isFinite(s.width) || s.width <= 0) continue;
                            if (typeof s.color !== 'string') continue;
                            const points = s.points.filter(isPoint);
                            if (points.length === 0) continue;
                            validStrokes.push({ tool: s.tool, width: s.width, color: s.color, points });
                        }
                        loadedLayers.push({ name: candidate.name, strokes: validStrokes });
                    }
                    if (loadedLayers.length > 0) {
                        layers = loadedLayers;
                        activeLayerIndex = 0;
                        isSaved = true;
                        console.log(`Loaded ${loadedLayers.length} layers from localStorage.`);
                        return;
                    }
                }
            }

            // Fall back to legacy flat strokes format.
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

            console.log(`Migrated ${loaded.length} strokes into Layer 1.`);
            layers = [{ name: 'Layer 1', strokes: loaded }];
            activeLayerIndex = 0;
            isSaved = true;
        } catch {
            // Ignore corrupt/unparseable saved data.
        }
    }

    function saveDrawing() {
        if (!browser || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(LAYERS_KEY, JSON.stringify(layers));
            window.localStorage.setItem(COLORS_KEY, JSON.stringify(penColors));
            isSaved = true;
        } catch {
            // Ignore quota / private-mode failures.
        }
    }

    function scheduleAutosave() {
        if (!browser || typeof window === 'undefined') return;
        if(!remember) return;
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

    // Returns squared distance from point p to the closest point on segment a→b.
    function pointToSegmentDistSq(p: Point, a: Point, b: Point): number {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) { const ex = p.x - a.x, ey = p.y - a.y; return ex * ex + ey * ey; }
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
        const cx = a.x + t * dx - p.x, cy = a.y + t * dy - p.y;
        return cx * cx + cy * cy;
    }

    // Returns true if any part of stroke comes within (eraserRadius + stroke.width/2) of the eraser segment.
    function strokeHitsEraser(stroke: Stroke, eraserFrom: Point, eraserTo: Point, eraserRadius: number): boolean {
        const threshold = eraserRadius + stroke.width / 2;
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

    function eraseAlongPath(from: Point, to: Point) {
        const radius = eraserWidth / 2;
        let erased = false;
        const activeStrokes = getActiveStrokes();
        for (let i = activeStrokes.length - 1; i >= 0; i--) {
            if (strokeHitsEraser(activeStrokes[i], from, to, radius)) {
                activeStrokes.splice(i, 1);
                erased = true;
            }
        }
        if (erased) {
            redrawFromStrokes();
            scheduleAutosave();
        }
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
            width: tool === 'eraser' ? eraserWidth : strokeWidth,
            tool
        };
        // Eraser strokes are not stored — they remove other strokes via hit-testing.
        if (tool !== 'eraser') {
            getActiveStrokes().push(currentStroke);
            scheduleAutosave();
        }
    }

    function getScreenPos(event: PointerEvent): Point {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function screenToWorld(p: Point): Point {
        return { x: (p.x - (viewTx + canvasCenterX)) / viewScale, y: (p.y - (viewTy + canvasCenterY)) / viewScale };
    }

    // Returns pointer position in world space (stroke coordinates).
    function getPos(event: PointerEvent): Point {
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
        const activeStrokes = getActiveStrokes();
        activeStrokes.splice(0, activeStrokes.length);
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
        if (getActiveStrokes().length === 0) return;
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

        getActiveStrokes().pop();
        redrawFromStrokes();
        scheduleAutosave();
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

    function drawStrokeOnCtx(targetCtx: CanvasRenderingContext2D, stroke: Stroke) {
        if (stroke.points.length === 0) return;
        console.debug(`Drawing stroke with ${stroke.points.length} points, color=${stroke.color}, width=${stroke.width}, tool=${stroke.tool}...`);
        targetCtx.save();
        applyStrokeStyle(targetCtx, stroke);
        if (stroke.points.length === 1) {
            targetCtx.fillStyle = stroke.tool === 'eraser' ? '#000000' : stroke.color;
            targetCtx.beginPath();
            targetCtx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
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

    function drawStroke(stroke: Stroke) {
        if (!ctx) return;
        drawStrokeOnCtx(ctx, stroke);
    }

    function onPointerDown(event: PointerEvent) {
        if (!ctx || !editing) return;
        layerDropdownOpen = false;
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
        if (!ctx || !editing) return;

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
        if (currentStroke.tool === 'eraser') {
            eraseAlongPath(prev, next);
        } else {
            drawSegment(prev, next, currentStroke);
            scheduleAutosave();
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
                if (tool === 'eraser') {
                    eraseAlongPath(tapStart, tapStart);
                } else {
                    const tapStroke: Stroke = {
                        points: [tapStart],
                        color: getActivePenColor(),
                        width: strokeWidth,
                        tool
                    };
                    getActiveStrokes().push(tapStroke);
                    drawDot(tapStart, tapStroke);
                    scheduleAutosave();
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

    function addLayer() {
        const newName = `Layer ${layers.length + 1}`;
        layers = [...layers, { name: newName, strokes: [] }];
        activeLayerIndex = layers.length - 1;
        layerDropdownOpen = false;
        scheduleAutosave();
    }

    function removeLayer(index: number) {
        if (layers.length <= 1) return;
        layers = layers.filter((_, i) => i !== index);
        if (activeLayerIndex >= layers.length) {
            activeLayerIndex = layers.length - 1;
        }
        redrawFromStrokes();
        layerDropdownOpen = false;
        scheduleAutosave();
    }

    function setActiveLayer(index: number) {
        if (index < 0 || index >= layers.length) return;
        activeLayerIndex = index;
        layerDropdownOpen = false;
        redrawFromStrokes();
    }

    $: exportBoxStyle = exportedDimensions
        ? `left:${(-exportedDimensions.width / 2) * viewScale + viewTx + canvasCenterX}px; top:${(-exportedDimensions.height / 2) * viewScale + viewTy + canvasCenterY}px; width:${exportedDimensions.width * viewScale}px; height:${exportedDimensions.height * viewScale}px;`
        : '';

    // Redraw whenever the view transform changes — handles external updates (e.g. bound
    // sliders in a parent) as well as ensuring the canvas context transform stays in sync.
    $: if (browser && ctx && canvas) {
        viewTx; viewTy; viewScale; // tracked as reactive dependencies
        redrawFromStrokes();
    }

    let resizeObserver: ResizeObserver | null = null;

    onMount(() => {
        ctx = canvas.getContext('2d');

        if(remember) loadDrawing();
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
        if(remember) saveDrawing();
        if (browser && typeof window !== 'undefined') {
            window.removeEventListener('resize', resizeCanvasAndRedraw);
        }
        resizeObserver?.disconnect();
    });
</script>

{#if !noeditbutton || editing}
<div class="toolbar" aria-label="Annotation tools">
    {#if !noeditbutton}
    <button
        class="button-style tool-button edit-toggle"
        on:click={toggleEditMode}
        aria-label={editing ? 'Commit' : 'Edit'}
        title={editing ? 'Commit' : 'Edit'}
    >
        {#if editing}
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width:100%;height:100%">
                <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
        {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width:100%;height:100%">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
        {/if}
    </button>
    {/if}

    {#if editing}
    <div class="tool-group">

    {#if remember}
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

    {/if}

    {#each penColors as color, i}
        <button
            class="button-style tool-button"
            class:highlight={tool === 'pen' && activePenIndex === i}
            style="border: 2px solid {color}; background-color: {tool === 'pen' && activePenIndex === i ? color : 'transparent'}; color: {tool === 'pen' && activePenIndex === i ? 'currentColor' : color}"
            on:click={() => { tool = 'pen'; activePenIndex = i; }}
            aria-label="Pen {i + 1}"
        >
            <PenIcon color={activePenIndex === i && tool === 'pen' ? 'currentColor' : color} style="width: 100%; height: 100%;" />
            <input
                class="pen-color-input"
                type="color"
                bind:value={penColors[i]}
                on:input={() => { penColors = penColors; }}
                aria-label="Select pen {i + 1} color"
                tabindex={tool === 'pen' && activePenIndex === i ? 0 : -1}
            />
        </button>
    {/each}
    <button class="button-style tool-button" class:highlight={tool === 'eraser'} on:click={() => (tool = 'eraser')}>
        <RubberIcon color="currentColor" style="width: 100%; height: 100%;" />
    </button>
    <button class="button-style tool-button" on:click={undoLastStroke} aria-label="Undo last stroke">Undo</button>
    <!-- <button class="button-style tool-button" on:click={resetView} aria-label="Reset view">Reset</button> -->
    <button class="button-style tool-button error" on:click={clearDrawing}>Clear</button>
    <div class="layer-dropdown-wrapper">
        <button
            class="button-style tool-button layer-toggle"
            on:click={() => (layerDropdownOpen = !layerDropdownOpen)}
            aria-label="Layers"
            title="Layers"
        >
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width:100%;height:100%">
                <path fill="currentColor" d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27z"/>
            </svg>
        </button>
        {#if layerDropdownOpen}
        <div class="layer-dropdown">
            {#each layers as layer, i}
                <div class="layer-item" class:active={i === activeLayerIndex}>
                    <button
                        class="layer-select-btn"
                        on:click={() => setActiveLayer(i)}
                        title="Switch to {layer.name}"
                    >
                        {layer.name}
                    </button>
                    {#if layers.length > 1}
                    <button
                        class="layer-delete-btn"
                        on:click|stopPropagation={() => removeLayer(i)}
                        aria-label="Delete {layer.name}"
                        title="Delete layer"
                    >&times;</button>
                    {/if}
                </div>
            {/each}
            <button class="layer-add-btn" on:click={addLayer}>+ Add Layer</button>
        </div>
        {/if}
    </div>
    </div>
    {/if}
</div>
{/if}

<div class="canvas-wrapper"
    aria-hidden="{!editing}"
    class:inactive={!editing}
    style="{canvasStyle}"
    >
    {#if exportedDimensions}
        <div class="export-box" style={exportBoxStyle} aria-hidden="true"></div>
    {/if}
    <canvas
        bind:this={canvas}
        class:inactive={!editing}
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={endStroke}
        on:pointercancel={endStroke}
        on:pointerleave={endStroke}
        on:pointerout={endStroke}
        aria-hidden="{!editing}"
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