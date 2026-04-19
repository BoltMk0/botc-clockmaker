<script lang="ts">
    import DrawableCanvas2 from "./DrawableCanvas2.svelte";
    import type { CanvasToolType, LayerControls } from "./types";

    export let tool: CanvasToolType|null = null;
    export let style: string = '';
    export let canvasStyle: string = '';
    export let saveCanvasAsBlob: (() => Promise<Blob | null>) | undefined = undefined;
    export let exportedDimensions: { width: number, height: number } | null = null;
    export let remember: boolean = false;
    export let layerControls: LayerControls;
    export let onchange: ()=>void = () => {};

    let viewTx: number = 0;
    let viewTy: number = 0;
    export let viewScale: number = 1;
</script>


<style>
    .anotatable-view-main {
        position: relative;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }

    .content-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        will-change: transform;
        /* transform-origin: 0 0; */
    }
</style>


<div class="anotatable-view-main" style="{style}">
    <div class="content-wrapper" style="transform: translate({viewTx}px, {viewTy}px) scale({viewScale});">
        <slot/>
    </div>
    <DrawableCanvas2 {onchange} bind:saveCanvasAsBlob bind:viewTx bind:viewTy bind:viewScale  bind:tool bind:layerControls {canvasStyle} {exportedDimensions}/>
</div>




