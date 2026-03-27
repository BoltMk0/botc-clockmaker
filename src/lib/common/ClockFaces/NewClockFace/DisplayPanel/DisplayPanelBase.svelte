<script lang="ts">
    export let title: string;
    export let style: string = "";
</script>

<style>
    .display-panel-base-main {
        display: grid;
        grid-template-rows: auto 1fr;
        /* border-radius: 10px; */
        color: #000A;
        background-color: var(--hue-dark);
        gap: 3px;
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
        background-color: var(--hue-dark);
        padding: 5px 10px;
        font-size: 1.5em;
        text-align: center;
        /* border-radius: 5px 5px 0 0; */
        color: #FFFA;
        text-overflow: clip;
        white-space: nowrap;    
    }

    .display-panel-base-content {
        background-color: var(--hue);
        font-size: 3em;
        text-align: center;
        overflow: hidden;
        /* border-radius: 0 0 5px 5px; */
    }
</style>


<div style="--hue-dark: hsl(from var(--hue) h calc(s*0.3) calc(l*0.64)); {style}">
    <div class="display-panel-base-main dumbledore-font">
        <div class="display-panel-base-title">{title}</div>
        <div class="display-panel-base-content">
            <slot></slot>
        </div>
    </div>
</div>