<script lang="ts">
    import { doubleTap } from "./doubleTap";

    /** Degrees either side of straight up that the knob turns through. */
    const SWEEP_DEG = 135;
    /** Vertical drag distance that takes the knob across its whole range. */
    const FULL_RANGE_DRAG_PX = 160;

    let {
        value = $bindable(0),
        min = -12,
        max = 12,
        step = 0.5,
        size = 26,
        title = undefined,
        onchange = () => {}
    }: {
        value?: number;
        min?: number;
        max?: number;
        step?: number;
        size?: number;
        title?: string;
        onchange?: (value: number) => void;
    } = $props();

    let dragPointerId: number|null = null;
    let dragStartY = 0;
    let dragStartValue = 0;

    function setValue(v: number) {
        const next = Math.min(max, Math.max(min, Math.round(v / step) * step));
        if (next === value) return;
        value = next;
        onchange(value);
    }

    function pointerdown(ev: PointerEvent) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        dragPointerId = ev.pointerId;
        dragStartY = ev.clientY;
        dragStartValue = value;
        (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
        ev.preventDefault(); // No text selection while dragging
    }

    function pointermove(ev: PointerEvent) {
        if (ev.pointerId !== dragPointerId) return;
        setValue(dragStartValue + (dragStartY - ev.clientY) * (max - min) / FULL_RANGE_DRAG_PX);
    }

    function pointerup(ev: PointerEvent) {
        if (ev.pointerId === dragPointerId) dragPointerId = null;
    }

    function keydown(ev: KeyboardEvent) {
        if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') setValue(value + step);
        else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') setValue(value - step);
        else return;
        ev.preventDefault();
    }

    // Double click/tap resets to 0, like the faders.
    function resetToZero() {
        setValue(Math.min(max, Math.max(min, 0)));
    }

    /** Point on a circle around the knob's centre, at an angle in degrees clockwise from straight up. */
    function point(r: number, deg: number) {
        const rad = deg * Math.PI / 180;
        return `${50 + r * Math.sin(rad)} ${50 - r * Math.cos(rad)}`;
    }

    function arc(r: number, fromDeg: number, toDeg: number) {
        const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
        const sweep = toDeg > fromDeg ? 1 : 0;
        return `M ${point(r, fromDeg)} A ${r} ${r} 0 ${largeArc} ${sweep} ${point(r, toDeg)}`;
    }

    const angleOf = (v: number) => -SWEEP_DEG + (v - min) / (max - min) * 2 * SWEEP_DEG;
    const angle = $derived(angleOf(value));
    const zeroAngle = $derived(angleOf(Math.min(max, Math.max(min, 0))));
</script>

<style>
    .knob {
        display: block;
        cursor: ns-resize;
        /* Dragging the knob mustn't scroll the page, and double-tap-to-zoom would eat the reset */
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }
</style>

<div
    class="knob"
    role="slider"
    tabindex="0"
    title={title}
    aria-label={title}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    onkeydown={keydown}
    onpointerdown={pointerdown}
    onpointermove={pointermove}
    onpointerup={pointerup}
    onpointercancel={pointerup}
    ondblclick={resetToZero}
    use:doubleTap={resetToZero}
>
<svg width={size} height={size} viewBox="0 0 100 100" style="display: block;">
    <path d={arc(44, -SWEEP_DEG, SWEEP_DEG)} fill="none" stroke="var(--theme-slider-trim)" stroke-width="10" stroke-linecap="round"/>
    {#if angle !== zeroAngle}
    <path d={arc(44, zeroAngle, angle)} fill="none" stroke="var(--theme-slider-accent)" stroke-width="10" stroke-linecap="round"/>
    {/if}
    <circle cx="50" cy="50" r="32" fill="#DDD" stroke="#555" stroke-width="3"/>
    <line x1="50" y1="50" x2="50" y2="22" stroke="#333" stroke-width="7" stroke-linecap="round" transform="rotate({angle} 50 50)"/>
</svg>
</div>
