<script lang="ts">
    export let style: string = '';
    export let size: string = '200px';
</script>

<div class="token-background-main" style="width: {size}; height: {size}; {style};">
    <slot/>
</div>

<style>
    .token-background-main {
        color-scheme: only light;
        position: relative;
        border-radius: 50%;
        aspect-ratio: 1 / 1;
        background-color: #efd6d6;
        color: black;
        border: 3px solid #c9b3b3;
        box-shadow: inset 0 0 10px #c9b3b3;
        overflow: hidden;
    }
</style>