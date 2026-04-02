<script lang="ts">
    import DrawableCanvas from "./DrawableCanvas.svelte";

    let buttonClicked = false;

    let viewTx: number = 0;
    let viewTy: number = 0;
    let viewScale: number = 1;
</script>

<div style="position: absolute; inset: 0; transform: translate({viewTx}px, {viewTy}px) scale({viewScale}); transform-origin: 0 0;">
    <h1>Test Page</h1>
<button style="position: absolute; left: 50%; top: 50%;" on:click={() => buttonClicked = !buttonClicked}>{buttonClicked ? "Clicked" : "Click me"}</button>
</div>
<DrawableCanvas bind:viewTx bind:viewTy bind:viewScale />

<div>{`viewTx: ${viewTx}, viewTy: ${viewTy}, viewScale: ${viewScale}`}</div>