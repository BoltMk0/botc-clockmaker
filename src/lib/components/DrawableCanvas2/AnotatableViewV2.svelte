<script lang="ts">
    import type { Snippet } from "svelte";
    import DrawableCanvas2 from "./DrawableCanvas2.svelte";
    import type { CanvasLayer, CanvasToolType } from "./types";

    interface Props {
        tool: CanvasToolType|null;
        style?: string;
        canvasStyle?: string;
        exportedDimensions?: { width: number, height: number };
        layers: CanvasLayer[];
        activeLayerIndex: number;
        viewScale?: number;
        viewTx?: number;
        viewTy?: number;
        children: Snippet;
        onchange?: ()=>void;
    }

    let {
        tool,
        style,
        canvasStyle,
        exportedDimensions,
        layers,
        activeLayerIndex,
        onchange,
        viewScale = $bindable(1),
        viewTx = $bindable(0),
        viewTy = $bindable(0),
        children,
    }: Props = $props();

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
        {@render children?.()}
    </div>
    <DrawableCanvas2 {onchange} bind:viewTx bind:viewTy bind:viewScale {tool} {canvasStyle} {exportedDimensions} {layers} {activeLayerIndex}/>
</div>




