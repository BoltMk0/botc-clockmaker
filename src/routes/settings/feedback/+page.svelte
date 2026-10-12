<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    function deleteEntry(filename: string) {
        if (!confirm("Are you sure you want to delete this feedback entry? This action cannot be undone.")) return;
        fetch(`/api/feedback/${encodeURIComponent(filename)}`, { method: "DELETE" }).then(async (response) => {
            if (response.ok) {
                await invalidateAll();
            } else {
                alert("Failed to delete feedback entry");
            }
        });
    }
</script>

<div class="center-content main">
    <div class="panel">
        <header>
            <h1>Feedback</h1>
        </header>
        <p class="description">Anonymous feedback submitted through the feedback form.</p>

        <div class="list-container">
            {#if data.entries.length === 0}
                <p class="empty">No feedback submitted yet.</p>
            {/if}

            <ul>
                {#each data.entries as entry (entry.filename)}
                    <li>
                        <div class="entry-header">
                            <span class="entry-date">{new Date(entry.timestamp).toLocaleString()}</span>
                            <button class="delete" title="Delete" aria-label="Delete entry" onclick={() => deleteEntry(entry.filename)}>✕</button>
                        </div>
                        <p class="entry-text">{entry.text}</p>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>

<style>
    .main {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        align-items: flex-start;
    }

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
        width: min(60rem, 100%);
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    h1 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .list-container {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    li {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background-color: var(--theme-bg-secondary);
        border-radius: 8px;
    }

    .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .entry-date {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--theme-on-bg-secondary);
        opacity: 0.8;
    }

    .entry-text {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    button:hover {
        filter: brightness(1.15);
    }

    .delete:hover {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    .empty {
        text-align: center;
        color: var(--theme-on-bg-secondary);
        margin: 0.5rem 0 1rem;
    }
</style>
