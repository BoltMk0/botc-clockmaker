<script lang="ts">
    import type { ReminderToken } from "$lib/common/database/types";

    export let data: ReminderToken;
    export let size: string = "80px";


    let hasImage = true;

    function fitText(node: HTMLDivElement, params: { text: string; size: string }) {
        function resize() {
            const parent = node.parentElement;
            if (!parent) return;
            let fontSize = parent.clientWidth / 3;
            node.style.fontSize = `${fontSize}px`;

            // Shrink until no word overflows horizontally and text fits vertically
            while ((node.scrollWidth > node.clientWidth || node.scrollHeight > parent.clientHeight) && fontSize > 4) {
                fontSize -= 0.5;
                node.style.fontSize = `${fontSize}px`;
            }
        }

        function scheduleResize() {
            requestAnimationFrame(resize);
        }

        // Resize when parent dimensions change (handles late layout)
        const observer = new ResizeObserver(scheduleResize);
        if (node.parentElement) observer.observe(node.parentElement);

        // Also resize after fonts finish loading
        document.fonts.ready.then(scheduleResize);

        return {
            update(_params: { text: string; size: string }) {
                scheduleResize();
            },
            destroy() {
                observer.disconnect();
            }
        };
    }
</script>

<style>
    .reminder-token-view-main {
        color-scheme: only light;
        width: var(--size);
        height: var(--size);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 20%;
        background-color: #eee;


        background-color: #efd6d6;
        color: black;
        border: 3px solid #c9b3b3;
    }

    .reminder-token-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .reminder-token-placeholder {
        width: 100%;
        color: #000;
        text-align: center;
        padding: 5%;
        overflow-wrap: normal;
        word-wrap: normal;
        box-sizing: border-box;
    }
</style>

<div class="reminder-token-view-main" style="--size: {size};">
    {#if hasImage}
        <img src={`/api/reminder_tokens/${data.id}/img`} alt="Reminder Token Image" class="reminder-token-image" on:error={() => hasImage = false} />
    {/if}
    <div style="padding: 10%; width: 100%; height: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
    <div class="reminder-token-placeholder dumbledore-font" use:fitText={{ text: data.text ?? "", size }}>{data.text}</div>
    </div>
</div>