<script lang="ts">
    export let title: string;
    export let value: boolean = false;
</script>

<style>
    .overlay-background {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .overlay-window-title {
        display: grid; 
        grid-template: 1fr auto;
        border-bottom: 1px solid #ccc;
    }

    .overlay-window {
        background: white;
        padding: 20px;
        border-radius: 8px;
        min-width: 300px;
        max-width: 80%;
        max-height: 80%;
        display: flex;
        flex-direction: column;
    }

    .close-button {
        justify-self: end;
        background-color: #f44336;
        color: white;
    }
</style>

<button class="button-style" on:click={()=>{value = true;}}>
    {title}
</button>
{#if value}
    <div class="overlay-background" on:click={()=>{value = false;}}>
        <div on:click|preventDefault|stopPropagation class="overlay-window">
            <div class="overlay-window-title">
                <div>{title}</div>
                <button on:click={()=>{value = false;}} class="button-style close-button">
                    Close
                </button>
            </div>
            <div class="overlay-content">
                <slot></slot>
            </div>
        </div>
    </div>
{/if}


