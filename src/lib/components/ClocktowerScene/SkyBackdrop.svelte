<script lang="ts">
    import * as THREE from "three";
    import { browser } from "$app/environment";
    import { Canvas } from "@threlte/core";
    import SkyBackdropScene from "./SkyBackdropScene.svelte";

    // Just the clocktower scene's sky (gradient, drifting clouds, sun and
    // mist) with no tower or UI, for use as a decorative page background.
    let {
        // Fixed time of day, same 0-1 scale as the scene's countdown progress.
        // Early on reads as a bright morning with the sun low on the left.
        progress = 0.15,
        visibleHeight = 5.5
    }: {
        progress?: number;
        visibleHeight?: number;
    } = $props();
</script>

<div class="sky-backdrop">
    {#if browser}
        <Canvas toneMapping={THREE.NoToneMapping}>
            <SkyBackdropScene {progress} {visibleHeight} />
        </Canvas>
    {/if}
</div>

<style>
    .sky-backdrop {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
</style>
