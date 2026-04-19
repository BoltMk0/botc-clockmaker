<script lang="ts">
    import HSlider from "$lib/components/AudioMixerComponents/HSlider.svelte";
    import DrawableCanvas from "$lib/components/DrawableCanvas.svelte";

    export let editing: boolean = false;
    export let noeditbutton: boolean = false;
    export let style: string = '';
    export let canvasStyle: string = '';
    export let saveCanvasAsBlob: (() => Promise<Blob | null>) | undefined = undefined;
    export let strokeWidth: number = 2;
    export let exportDimensions: { width: number, height: number } | null = null;
    export let remember: boolean = false;

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
    <DrawableCanvas remember={remember} bind:editing bind:noeditbutton bind:saveCanvasAsBlob bind:viewTx bind:viewTy bind:viewScale canvasStyle={canvasStyle} bind:strokeWidth exportedDimensions={exportDimensions}/>
</div>




