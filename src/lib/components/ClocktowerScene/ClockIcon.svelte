<script lang="ts">
    import * as THREE from "three";
    import { browser } from "$app/environment";
    import { Canvas } from "@threlte/core";
    import ClockIconScene from "./ClockIconScene.svelte";
    import { realTimeDayProgress, realTimeHandProgress } from "./realTime";

    // The clocktower's dial on its own - face, hands and the corpse on the
    // minute hand - showing the real time of day, with the day's light (and
    // the dial's red night glow) following it.
    let {
        now,
        size = 128
    }: {
        now: Date;
        size?: number;
    } = $props();

    const hands = $derived(realTimeHandProgress(now));
</script>

<div class="clock-icon" style="width: {size}px; height: {size}px;">
    {#if browser}
        <Canvas
            createRenderer={(canvas) => {
                const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
                renderer.setClearColor(0x000000, 0);
                return renderer;
            }}
            toneMapping={THREE.NoToneMapping}
        >
            <ClockIconScene progress={realTimeDayProgress(now)} minuteHandProgress={hands.minute} hourHandProgress={hands.hour} />
        </Canvas>
    {/if}
</div>

<style>
    .clock-icon {
        position: relative;
        flex-shrink: 0;
    }
</style>
