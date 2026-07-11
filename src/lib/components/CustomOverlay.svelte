<script lang="ts">
    import type { Snippet } from 'svelte';

    let {
        title,
        buttonTitle = title,
        visible = $bindable(false),
        children,
    }: {
        title: string;
        buttonTitle?: string;
        visible?: boolean;
        children?: Snippet;
    } = $props();
</script>

<style>
    .overlay-background {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    }

    .overlay-window-title {
        display: grid; 
        grid-template-columns: 1fr auto;
        background-color: var(--theme-bg-secondary);
    }

    .overlay-window {
        background: var(--theme-bg);
        color: var(--theme-on-bg-secondary);
        border-radius: 8px;
        overflow: hidden;
        min-width: 300px;
        max-width: 80%;
        max-height: 80%;
        display: flex;
        flex-direction: column;
    }

    .close-button {
        justify-self: end;
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    .overlay-content {
        padding: 20px;
        overflow-y: auto;
    }
</style>

<button class="button-style" onclick={()=>{visible = true;}}>
    {buttonTitle}
</button>
{#if visible}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="overlay-background" onclick={()=>{visible = false;}} role="dialog" tabindex="-1">
        <div onclick={(e) => e.stopPropagation()} class="overlay-window" role="dialog" tabindex="-1">
            <div class="overlay-window-title">
                <div style="font-size: large; text-align: left; padding: 5px 10px;">{title}</div>
                <button onclick={()=>{visible = false;}} class="button-style close-button">
                    Close
                </button>
            </div>
            <div class="overlay-content">
                {@render children?.()}
            </div>
        </div>
    </div>
{/if}


