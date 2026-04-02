<script lang="ts">
    export let style: string = "";
</script>

<style>
    .audio-mixer-text {
        width: 100%;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        margin-bottom: 8px;
        background-color: var(--theme-slider-accent);
        color: #4c6851;
        padding: 4px;
        text-align: center;
        border-radius: 3px;
        box-shadow: 0px 2px 8px 0px #0009 inset;
        border: 3px solid var(--theme-slider-trim);
        text-align: center;
    }
</style>

<div class="audio-mixer-text" style={style}>
    <slot/>
</div>
