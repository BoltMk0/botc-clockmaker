<script lang="ts">
    import { CHARACTER_CATEGORIES, type Character, type ScriptCharacter } from "$lib/database/common/types.js";
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";
    import Navbar from "$lib/components/Navbar.svelte";
    import { goto } from "$app/navigation";
    export let data;

    const characterMap = new Map<number, ScriptCharacter>(data.characters.map((c: any) => [c.id, c]));

    const FILTER_OPTIONS = ['all', ...CHARACTER_CATEGORIES, 'traveler'] as const;
    type FilterOption = typeof FILTER_OPTIONS[number];

    let searchQuery = "";
    let categoryFilter: FilterOption = 'all';

    type NightList = 'first' | 'other';
    let dragState: { list: NightList; id: number } | null = null;
    let dropTargetId: number | null = null;
    let dropPosition: 'before' | 'after' = 'before';

    $: inUseCharacterIds = new Set(data.script.characters.map((c: any) => c.id));
    $: filteredCharacters = (data.characters as Character[])
        .filter(c => categoryFilter === 'all' || c.category === categoryFilter)
        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    function orderSort(key: 'firstNightOrder' | 'otherNightOrder') {
        return (a: ScriptCharacter, b: ScriptCharacter) => {
            const ao = a[key] ?? Number.POSITIVE_INFINITY;
            const bo = b[key] ?? Number.POSITIVE_INFINITY;
            if (ao !== bo) return ao - bo;
            return a.name.localeCompare(b.name);
        };
    }

    $: firstNightList = (data.script.characters as ScriptCharacter[])
        .filter(c => !!c.wakes_first_night)
        .sort(orderSort('firstNightOrder'));
    $: otherNightList = (data.script.characters as ScriptCharacter[])
        .filter(c => !!c.wakes_other_nights)
        .sort(orderSort('otherNightOrder'));

    function captialiseString(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function onAddCharacter(characterId: number) {
        if(data.script.characters.some((c: any) => c.id === characterId)){
            data.script.characters = data.script.characters.filter((c: any) => c.id !== characterId);
        } else {
            const char = characterMap.get(characterId);
            if(!char) {
                alert(`Character with id ${characterId} not found`);
                return;
            }
            data.script.characters.push(char);
        }
        data = data;
    }

    function onDragStart(e: DragEvent, list: NightList, id: number) {
        dragState = { list, id };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(id));
        }
    }

    function onDragOverRow(e: DragEvent, list: NightList, id: number) {
        if (!dragState || dragState.list !== list) return;
        e.preventDefault();
        const row = e.currentTarget as HTMLElement;
        const rect = row.getBoundingClientRect();
        dropPosition = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
        dropTargetId = id;
    }

    function onDropRow(e: DragEvent, list: NightList, targetId: number) {
        if (!dragState || dragState.list !== list) return;
        e.preventDefault();
        const currentList = list === 'first' ? firstNightList : otherNightList;
        const movedId = dragState.id;
        if (movedId === targetId) {
            clearDrag();
            return;
        }
        const remaining = currentList.filter(c => c.id !== movedId);
        const targetIdx = remaining.findIndex(c => c.id === targetId);
        if (targetIdx === -1) {
            clearDrag();
            return;
        }
        const insertAt = dropPosition === 'before' ? targetIdx : targetIdx + 1;
        const moved = currentList.find(c => c.id === movedId);
        if (!moved) {
            clearDrag();
            return;
        }
        const reordered = [...remaining.slice(0, insertAt), moved, ...remaining.slice(insertAt)];
        applyOrder(list, reordered);
        clearDrag();
    }

    function applyOrder(list: NightList, ordered: ScriptCharacter[]) {
        const key = list === 'first' ? 'firstNightOrder' : 'otherNightOrder';
        const orderById = new Map(ordered.map((c, i) => [c.id, i + 1]));
        data.script.characters = data.script.characters.map((c: ScriptCharacter) => {
            const n = orderById.get(c.id);
            if (n === undefined) return c;
            return { ...c, [key]: n };
        });
    }

    function clearDrag() {
        dragState = null;
        dropTargetId = null;
    }

    async function save() {
        try {
            const id = data.script.id;
            const metaRes = await fetch(`/api/scripts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: data.script.name, hue: data.script.hue }),
            });
            if (!metaRes.ok) throw new Error(`metadata: ${metaRes.status}`);

            const charsRes = await fetch(`/api/scripts/${id}/characters`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characters: (data.script.characters as ScriptCharacter[]).map(c => ({
                        characterId: c.id,
                        firstNightOrder: c.firstNightOrder ?? null,
                        otherNightOrder: c.otherNightOrder ?? null,
                    })),
                }),
            });
            if (!charsRes.ok) throw new Error(`characters: ${charsRes.status}`);

            alert('Script saved successfully');
        } catch (er) {
            alert(`Failed to save script: ${er}`);
        }
    }
</script>

<style>
    .character-list-item button {
        width: 100%;
        padding: 0.5em;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border: 2px solid transparent;
        border-radius: 0.5em;
        display: flex;
        align-items: center;
        gap: 0.6em;
        text-align: left;
    }
    .character-list-item button.in-use {
        border-color: var(--theme-highlight);
    }

    .character-row-body {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15em;
    }
    .character-row-name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .character-row-rules {
        font-size: 0.8em;
        opacity: 0.7;
        line-height: 1.25;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
    }

    .character-category-column-main {
        height: 100%;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr;
    }
    .character-category-column-content {
        overflow-y: scroll;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }

    .filter-bar {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.5em;
        padding-bottom: 0.5em;
    }
    .filter-bar input[type="text"] {
        width: 100%;
        box-sizing: border-box;
        padding: 0.4em 0.6em;
    }
    .radio-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em 0.75em;
    }
    .radio-group label {
        display: inline-flex;
        align-items: center;
        gap: 0.25em;
        cursor: pointer;
        user-select: none;
    }

    .category-badge {
        font-size: 0.75em;
        padding: 0.1em 0.6em;
        border-radius: 0.75em;
        opacity: 0.8;
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .category-townsfolk { background-color: #4a90d9; color: #fff; }
    .category-outsider  { background-color: #6fa9dc; color: #fff; }
    .category-minion    { background-color: #d96a4a; color: #fff; }
    .category-demon     { background-color: #b63737; color: #fff; }
    .category-traveler  { background-color: #7a6fb6; color: #fff; }

    .night-order-column {
        height: 100%;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr auto 1fr;
        gap: 0.25em;
    }
    .night-section-header {
        font-weight: 600;
        padding: 0.25em 0;
    }
    .night-list {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        padding: 0.15em;
    }

    .drag-row {
        position: relative;
    }
    .drag-row[data-drop="before"]::before,
    .drag-row[data-drop="after"]::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--theme-highlight, #4a90d9);
        border-radius: 2px;
        pointer-events: none;
    }
    .drag-row[data-drop="before"]::before { top: -3px; }
    .drag-row[data-drop="after"]::after { bottom: -3px; }
    .drag-row.dragging { opacity: 0.4; }

    .order-chip {
        flex-shrink: 0;
        min-width: 1.75em;
        height: 1.75em;
        border-radius: 50%;
        background: var(--theme-highlight, #4a90d9);
        color: var(--theme-on-primary, #fff);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85em;
        font-weight: 700;
    }
    .drag-row button {
        cursor: grab;
    }
    .drag-row button:active {
        cursor: grabbing;
    }
</style>

<div style="width: 100%; height: 100%;">
    <div style="width: 100%; height: 100%; display: grid; grid-template-rows: auto 1fr; gap: 1em; overflow: hidden;" class="scripts-main">
        <div style="justify-content: space-between; background-color: var(--theme-bg-secondary); padding: 0.5em 1em;" class="in-a-row padded">
            <button class="button-style" on:click={() => goto('/settings/scripts')}>Back</button>
            <input type="text" placeholder="Script Name" bind:value={data.script.name} style="font-size: large; padding: 0.2em 0.5em;" class="input-style" required/>
            <button class="button-style highlight" on:click={save}>Save</button>
        </div>
        <div style="width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1em; overflow: hidden;" class="padded">
            <div class="character-category-column-main">
                <div class="character-category-column-header filter-bar">
                    <input type="text" placeholder="Search characters..." bind:value={searchQuery} class="button-style"/>
                    <div class="radio-group">
                        {#each FILTER_OPTIONS as opt}
                            <label>
                                <input type="radio" bind:group={categoryFilter} value={opt}/>
                                {opt === 'all' ? 'All' : captialiseString(opt)}
                            </label>
                        {/each}
                    </div>
                </div>
                <div class="character-category-column-content">
                    {#each filteredCharacters as character (character.id)}
                        <div class="character-list-item">
                            <button class:in-use={inUseCharacterIds.has(character.id)} on:click={() => onAddCharacter(character.id)}>
                                <CharacterThumb {character}/>
                                <div class="character-row-body">
                                    <div class="character-row-name">{character.name}</div>
                                    <div class="character-row-rules">{character.rules}</div>
                                </div>
                                <span class="category-badge category-{character.category}">{captialiseString(character.category)}</span>
                            </button>
                        </div>
                    {/each}
                </div>
            </div>

            <div class="character-category-column-main">
                <div class="character-category-column-header">
                    <div>In Script</div>
                </div>
                <div class="character-category-column-content">
                    {#each [...CHARACTER_CATEGORIES, 'traveler'] as category}
                        {@const inCat = data.script.characters.filter((c: ScriptCharacter) => c.category === category)}
                        {#if inCat.length > 0}
                            <div style="opacity: 0.6;">{captialiseString(category)} ({inCat.length})</div>
                            {#each inCat as character}
                                <div class="character-list-item">
                                    <button class:in-use={true} on:click={() => onAddCharacter(character.id)}>
                                        <CharacterThumb {character}/>
                                        <div class="character-row-body">
                                            <div class="character-row-name">{character.name}</div>
                                            <div class="character-row-rules">{character.rules}</div>
                                        </div>
                                    </button>
                                </div>
                            {/each}
                        {/if}
                    {/each}
                </div>
            </div>

            <div class="night-order-column">
                <div class="night-section-header">First Night ({firstNightList.length})</div>
                <div class="night-list" role="list">
                    {#each firstNightList as character, i (character.id)}
                        <div
                            class="character-list-item drag-row"
                            class:dragging={dragState?.list === 'first' && dragState?.id === character.id}
                            data-drop={dropTargetId === character.id && dragState?.list === 'first' ? dropPosition : null}
                            draggable="true"
                            role="listitem"
                            on:dragstart={(e) => onDragStart(e, 'first', character.id)}
                            on:dragover={(e) => onDragOverRow(e, 'first', character.id)}
                            on:drop={(e) => onDropRow(e, 'first', character.id)}
                            on:dragend={clearDrag}
                        >
                            <button class:in-use={true}>
                                <span class="order-chip">{i + 1}</span>
                                <CharacterThumb {character}/>
                                <div class="character-row-body">
                                    <div class="character-row-name">{character.name}</div>
                                    <div class="character-row-rules">{character.rules}</div>
                                </div>
                            </button>
                        </div>
                    {/each}
                </div>

                <div class="night-section-header">Other Nights ({otherNightList.length})</div>
                <div class="night-list" role="list">
                    {#each otherNightList as character, i (character.id)}
                        <div
                            class="character-list-item drag-row"
                            class:dragging={dragState?.list === 'other' && dragState?.id === character.id}
                            data-drop={dropTargetId === character.id && dragState?.list === 'other' ? dropPosition : null}
                            draggable="true"
                            role="listitem"
                            on:dragstart={(e) => onDragStart(e, 'other', character.id)}
                            on:dragover={(e) => onDragOverRow(e, 'other', character.id)}
                            on:drop={(e) => onDropRow(e, 'other', character.id)}
                            on:dragend={clearDrag}
                        >
                            <button class:in-use={true}>
                                <span class="order-chip">{i + 1}</span>
                                <CharacterThumb {character}/>
                                <div class="character-row-body">
                                    <div class="character-row-name">{character.name}</div>
                                    <div class="character-row-rules">{character.rules}</div>
                                </div>
                            </button>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>
