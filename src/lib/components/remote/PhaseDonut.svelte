<script lang="ts" module>
    export type DonutSegment = { key: string; label: string; value: number; color: string };
    /** An arc in the outer ring, around the segments it's made of (e.g. a day around its phases). */
    export type DonutGroup = { key: string; label: string; tick: string; segments: number };
</script>

<script lang="ts">
    import { formatDuration } from "$lib/model/common/phaseLog";

    /**
     * A pie (a ring, with the total or the segment picked in the middle) of how time divides up. Segments are hovered,
     * or tapped, for their time and share. With groups, a thin outer ring marks off runs of segments (e.g. days).
     */
    let { segments, groups = [], totalLabel = 'Total', ariaLabel }: {
        segments: DonutSegment[];
        groups?: DonutGroup[];
        totalLabel?: string;
        ariaLabel: string;
    } = $props();

    const SIZE = 250;
    const C = SIZE / 2;
    const R_IN = 62;
    const R_OUT = 98;
    const GROUP_IN = 102;
    const GROUP_OUT = 107;
    const TICK_R = 117;
    /** Groups narrower than this (radians) aren't labelled, not to crowd the ring. */
    const MIN_TICK_ANGLE = 0.22;

    const total = $derived(segments.reduce((sum, s) => sum + s.value, 0));

    // Each segment's angles, clockwise from the top
    const arcs = $derived.by(() => {
        let a = 0;
        return segments.map(s => {
            const a0 = a;
            a += total > 0 ? (s.value / total) * Math.PI * 2 : 0;
            return { ...s, a0, a1: a };
        });
    });

    const groupArcs = $derived.by(() => {
        let i = 0;
        return groups.map((g, n) => {
            const first = arcs[i], last = arcs[i + g.segments - 1];
            i += g.segments;
            const value = arcs.slice(i - g.segments, i).reduce((sum, s) => sum + s.value, 0);
            return { ...g, a0: first?.a0 ?? 0, a1: last?.a1 ?? 0, value, alt: n % 2 === 1 };
        });
    });

    function point(r: number, a: number) {
        return `${(C + r * Math.sin(a)).toFixed(2)} ${(C - r * Math.cos(a)).toFixed(2)}`;
    }

    function arcPath(r0: number, r1: number, a0: number, a1: number) {
        // A whole ring can't be drawn as one arc: stop just short of it
        a1 = Math.min(a1, a0 + Math.PI * 2 - 1e-4);
        const large = a1 - a0 > Math.PI ? 1 : 0;
        return `M ${point(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${point(r1, a1)} L ${point(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${point(r0, a0)} Z`;
    }

    /** The segment or group picked (hovered, or tapped), shown in the middle. */
    let picked: { label: string; value: number } | null = $state(null);
    let pickedKey: string | null = $state(null);

    function pick(key: string, label: string, value: number) {
        pickedKey = key;
        picked = { label, value };
    }

    function unpick() {
        pickedKey = null;
        picked = null;
    }

    function toggle(key: string, label: string, value: number) {
        if (pickedKey === key) unpick();
        else pick(key, label, value);
    }

    function percent(value: number) {
        return total > 0 ? Math.round((value / total) * 100) : 0;
    }
</script>

<svg class="donut" viewBox="0 0 {SIZE} {SIZE}" role="img" aria-label={ariaLabel}>
    {#each arcs as s (s.key)}
        {#if s.value > 0}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <path class="segment" class:faded={pickedKey !== null && pickedKey !== s.key} d={arcPath(R_IN, R_OUT, s.a0, s.a1)} fill={s.color}
            onpointerenter={(e) => e.pointerType === 'mouse' && pick(s.key, s.label, s.value)}
            onpointerleave={(e) => e.pointerType === 'mouse' && unpick()}
            onclick={() => toggle(s.key, s.label, s.value)}>
            <title>{s.label}: {formatDuration(s.value)} ({percent(s.value)}%)</title>
        </path>
        {/if}
    {/each}
    {#each groupArcs as g (g.key)}
        {#if g.value > 0}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <path class="group" class:alt={g.alt} class:faded={pickedKey !== null && pickedKey !== g.key} d={arcPath(GROUP_IN, GROUP_OUT, g.a0, g.a1)}
            onpointerenter={(e) => e.pointerType === 'mouse' && pick(g.key, g.label, g.value)}
            onpointerleave={(e) => e.pointerType === 'mouse' && unpick()}
            onclick={() => toggle(g.key, g.label, g.value)}>
            <title>{g.label}: {formatDuration(g.value)} ({percent(g.value)}%)</title>
        </path>
        {#if g.a1 - g.a0 >= MIN_TICK_ANGLE}
        <text class="tick" x={C + TICK_R * Math.sin((g.a0 + g.a1) / 2)} y={C - TICK_R * Math.cos((g.a0 + g.a1) / 2)}>{g.tick}</text>
        {/if}
        {/if}
    {/each}
    <text class="centre-label" x={C} y={C - 12}>{picked ? picked.label : totalLabel}</text>
    <text class="centre-value" x={C} y={C + 12}>{formatDuration(picked ? picked.value : total)}</text>
    {#if picked}<text class="centre-share" x={C} y={C + 30}>{percent(picked.value)}%</text>{/if}
</svg>

<style>
    .donut {
        display: block;
        width: 100%;
        max-width: 280px;
        margin: 0 auto;
        overflow: visible;
        font-variant-numeric: tabular-nums;
    }

    /* A 2px gap of the surface between segments */
    .segment, .group {
        stroke: var(--surface);
        stroke-width: 2;
        cursor: pointer;
        transition: opacity 0.15s;
    }

    .group {
        stroke-width: 1.5;
        fill: color-mix(in srgb, #fff 35%, var(--surface));
    }

    .group.alt {
        fill: color-mix(in srgb, #fff 65%, var(--surface));
    }

    .faded {
        opacity: 0.35;
    }

    text {
        fill: var(--theme-on-bg);
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
    }

    .tick {
        font-size: 10px;
        opacity: 0.7;
    }

    .centre-label {
        font-size: 12px;
        opacity: 0.7;
    }

    .centre-value {
        font-size: 22px;
        font-weight: 600;
    }

    .centre-share {
        font-size: 11px;
        opacity: 0.7;
    }
</style>
