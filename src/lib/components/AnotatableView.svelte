<script lang="ts">
    import type { Snippet } from 'svelte';
    import DrawableCanvas from "$lib/components/DrawableCanvas.svelte";

    let {
        editing = $bindable(false),
        noeditbutton = $bindable(false),
        style = '',
        canvasStyle = '',
        saveCanvasAsBlob = $bindable(undefined),
        strokeWidth = $bindable(2),
        exportDimensions = null,
        remember = false,
        viewScale = $bindable(1),
        children,
    }: {
        editing?: boolean;
        noeditbutton?: boolean;
        style?: string;
        canvasStyle?: string;
        saveCanvasAsBlob?: (() => Promise<Blob | null>) | undefined;
        strokeWidth?: number;
        exportDimensions?: { width: number, height: number } | null;
        remember?: boolean;
        viewScale?: number;
        children?: Snippet;
    } = $props();

    let viewTx: number = $state(0);
    let viewTy: number = $state(0);

    let drawableCanvas: ReturnType<typeof DrawableCanvas> | undefined = $state();

    $effect(() => {
        saveCanvasAsBlob = () => drawableCanvas?.saveCanvasAsBlob() ?? Promise.resolve(null);
    });
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
    <DrawableCanvas bind:this={drawableCanvas} remember={remember} bind:editing bind:noeditbutton bind:viewTx bind:viewTy bind:viewScale canvasStyle={canvasStyle} bind:strokeWidth exportedDimensions={exportDimensions}/>
</div>




