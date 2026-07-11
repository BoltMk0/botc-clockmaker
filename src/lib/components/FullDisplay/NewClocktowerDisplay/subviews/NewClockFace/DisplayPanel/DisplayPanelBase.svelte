<script lang="ts">
    import { getNewClocktowerThemeContext } from "$lib/components/FullDisplay/NewClocktowerDisplay/model/theme";
    import type { Snippet } from "svelte";

    let {
        title,
        style = "",
        children
    }: {
        title: string;
        style?: string;
        children?: Snippet;
    } = $props();

    const theme = getNewClocktowerThemeContext();
</script>

<style>
    .display-panel-base-main {
        display: grid;
        grid-template-rows: auto 1fr;
        padding: 5px;
        box-sizing: border-box;
        transition: background-color 1s ease;
        height: 100%;
    }

    .display-panel-base-main>*{
        box-sizing: border-box;
        transition: background-color 1s ease;
    }

    .display-panel-base-title {
        padding: 5px 10px;
        font-size: 1.5em;
        text-align: center;
        /* border-radius: 5px 5px 0 0; */
        color: #FFFA;
        text-overflow: clip;
        white-space: nowrap;    
    }

    .display-panel-base-content {
        font-size: 3em;
        text-align: center;
        overflow: hidden;
        border-radius: 0 0 5px 5px;
        box-shadow: 0 0 20px #0005 inset;
    }
</style>


<div style="color: {theme.panelTextColor}; {style}; transition: color 0.5s ease;">
    <div class="display-panel-base-main dumbledore-font">
        <div class="display-panel-base-title" style="background-color: {theme.panelColorSecondary}">{title}</div>
        <div class="display-panel-base-content" style="background-color: {theme.panelColorPrimary};">
            {@render children?.()}
        </div>
    </div>
</div>