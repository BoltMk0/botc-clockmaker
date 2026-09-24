<script lang="ts">
    import { ALL_CHARACTER_CATEGORIES, CHARACTER_CATEGORIES, type Character, type CharacterCategory, type ScriptCharacter } from "$lib/resources/common/gameData.js";
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";
    import { goto } from "$app/navigation";
    import type { PageData } from "./$types";
    let { data }: { data: PageData } = $props();

    const characterMap = new Map<string, ScriptCharacter>(data.characters.map((c: any) => [c.id, c]));

    let searchQuery = $state("");
    // Travellers, Loric & Fabled are hidden by default - most scripts are built from the four core teams
    let categoryFilter: CharacterCategory[] = $state([...CHARACTER_CATEGORIES]);

    function resetCategoryFilter() {
        categoryFilter = [...CHARACTER_CATEGORIES];
    }

    type NightList = 'first' | 'other';
    // 'script' is the "In Script" column, where rows can only be reordered within their category
    type DragList = NightList | 'script';
    let dragState: { list: DragList; id: string } | null = $state(null);
    let dropTargetId: string | null = $state(null);
    let dropPosition: 'before' | 'after' = $state('before');

    // Empty string means no script filter
    let scriptFilterId = $state("");
    const scriptFilterCharacterIds = $derived.by(() => {
        const script = data.filterScripts.find(s => s.id === scriptFilterId);
        return script ? new Set(script.characterIds) : null;
    });

    const inUseCharacterIds = $derived(new Set(data.script.characters.map((c: any) => c.id)));
    const filteredCharacters = $derived((data.characters as Character[])
        .filter(c => categoryFilter.includes(c.category))
        .filter(c => !scriptFilterCharacterIds || scriptFilterCharacterIds.has(c.id))
        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())));

    function orderSort(key: 'firstNightOrder' | 'otherNightOrder') {
        return (a: ScriptCharacter, b: ScriptCharacter) => {
            const ao = a[key] ?? Number.POSITIVE_INFINITY;
            const bo = b[key] ?? Number.POSITIVE_INFINITY;
            if (ao !== bo) return ao - bo;
            return a.name.localeCompare(b.name);
        };
    }

    const firstNightList = $derived((data.script.characters as ScriptCharacter[])
        .filter(c => !!c.wakes_first_night)
        .sort(orderSort('firstNightOrder')));
    const otherNightList = $derived((data.script.characters as ScriptCharacter[])
        .filter(c => !!c.wakes_other_nights)
        .sort(orderSort('otherNightOrder')));

    function captialiseString(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function onAddCharacter(characterId: string) {
        if(data.script.characters.some((c: any) => c.id === characterId)){
            data.script.characters = data.script.characters.filter((c: any) => c.id !== characterId);
        } else {
            const char = characterMap.get(characterId);
            if(!char) {
                alert(`Character with id ${characterId} not found`);
                return;
            }
            const added: ScriptCharacter = { ...char, firstNightOrder: null, otherNightOrder: null };
            data.script.characters.push(added);
            insertIntoNightOrder('first', added);
            insertIntoNightOrder('other', added);
        }
        // `data = data` is a no-op: same reference in, same reference out, so Svelte's
        // equality check skips invalidation. A shallow copy forces reactivity to notice.
        data = { ...data };
    }

    function onDragStart(e: DragEvent, list: DragList, id: string) {
        dragState = { list, id };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(id));
        }
    }

    function scriptCategoryOf(id: string) {
        return (data.script.characters as ScriptCharacter[]).find(c => c.id === id)?.category;
    }

    function canDropOn(list: DragList, targetId: string) {
        if (!dragState || dragState.list !== list) return false;
        if (list === 'script') return scriptCategoryOf(dragState.id) === scriptCategoryOf(targetId);
        return true;
    }

    function onDragOverRow(e: DragEvent, list: DragList, id: string) {
        if (!canDropOn(list, id)) {
            if (dropTargetId === id) dropTargetId = null;
            return;
        }
        e.preventDefault();
        const row = e.currentTarget as HTMLElement;
        const rect = row.getBoundingClientRect();
        dropPosition = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
        dropTargetId = id;
    }

    function onDropRow(e: DragEvent, list: DragList, targetId: string) {
        if (!dragState || !canDropOn(list, targetId)) return;
        e.preventDefault();
        const currentList = list === 'script'
            ? data.script.characters as ScriptCharacter[]
            : list === 'first' ? firstNightList : otherNightList;
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
        if (list === 'script') {
            // The script's character array order is persisted as-is, so it is the display order
            data.script.characters = reordered;
            data = { ...data };
        } else {
            applyOrder(list, reordered);
        }
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
        // `data` is only shallow-reactive as a prop, and `data = data` is a same-reference
        // no-op, so reassign a shallow copy to force $derived (firstNightList/otherNightList)
        // to notice this nested mutation.
        data = { ...data };
    }

    // Slots a newly added character into one night's existing (possibly manually edited) order,
    // just before the first character whose default night order comes after its own. Characters
    // with no scraped default go to the end. Every waking character ends up numbered, so the
    // server doesn't see a null order on save and re-rank the whole night from defaults.
    function insertIntoNightOrder(list: NightList, added: ScriptCharacter) {
        const key = list === 'first' ? 'firstNightOrder' : 'otherNightOrder';
        const defaultKey = list === 'first' ? 'defaultFirstNightOrder' : 'defaultOtherNightOrder';
        const wakesKey = list === 'first' ? 'wakes_first_night' : 'wakes_other_nights';
        if (!added[wakesKey]) return;

        const current = (data.script.characters as ScriptCharacter[])
            .filter(c => c[wakesKey] && c.id !== added.id)
            .sort(orderSort(key));
        const addedDefault = added[defaultKey];
        let insertAt = addedDefault == null
            ? -1
            : current.findIndex(c => c[defaultKey] != null && (c[defaultKey] as number) > addedDefault);
        if (insertAt === -1) insertAt = current.length;

        applyOrder(list, [...current.slice(0, insertAt), added, ...current.slice(insertAt)]);
    }

    // Re-derives the order for one night from each character's canonical default night order,
    // discarding any manual ordering. Characters that don't wake this night, or have no
    // scraped default, end up with no order.
    function resetNightOrder(list: NightList) {
        const key = list === 'first' ? 'firstNightOrder' : 'otherNightOrder';
        const defaultKey = list === 'first' ? 'defaultFirstNightOrder' : 'defaultOtherNightOrder';
        const wakesKey = list === 'first' ? 'wakes_first_night' : 'wakes_other_nights';

        const ranked = (data.script.characters as ScriptCharacter[])
            .filter(c => c[wakesKey] && c[defaultKey] != null)
            .sort((a, b) => (a[defaultKey] as number) - (b[defaultKey] as number));
        const rankById = new Map(ranked.map((c, i) => [c.id, i + 1]));

        data.script.characters = (data.script.characters as ScriptCharacter[]).map(c => ({
            ...c,
            [key]: rankById.get(c.id) ?? null
        }));
        data = { ...data };
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

            await goto('/settings/scripts');
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
    .category-loric     { background-color: #2f9e8f; color: #fff; }
    .category-fabled    { background-color: #c9508b; color: #fff; }

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
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5em;
    }
    .reset-order-button {
        font-weight: normal;
        font-size: 0.8em;
        padding: 0.15em 0.6em;
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
            <button class="button-style" onclick={() => goto(`/settings/scripts/${data.script.id}`)}>Back</button>
            <div style="display: flex; align-items: center; gap: 0.5em;">
                <input type="color" bind:value={data.script.hue} style="width: 2.2em; height: 2.2em; padding: 0;" title="Script colour"/>
                <input type="text" placeholder="Script Name" bind:value={data.script.name} style="font-size: large; padding: 0.2em 0.5em;" class="input-style" required/>
            </div>
            <button class="button-style highlight" onclick={save}>Save</button>
        </div>
        <div style="width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1em; overflow: hidden;" class="padded">
            <div class="character-category-column-main">
                <div class="character-category-column-header filter-bar">
                    <input type="text" placeholder="Search characters..." bind:value={searchQuery} class="button-style"/>
                    <!-- The hidden placeholder option is what shows while no script is selected; picking
                         "None" maps back to it so the closed dropdown reads "Filter by script..." -->
                    <select
                        value={scriptFilterId}
                        onchange={(e) => {
                            const value = e.currentTarget.value;
                            scriptFilterId = value === 'none' ? '' : value;
                            e.currentTarget.value = scriptFilterId;
                        }}
                        class="button-style"
                        title="Only show characters from this script"
                    >
                        <option value="" hidden>Filter by script...</option>
                        <option value="none">None</option>
                        {#each data.filterScripts as script (script.id)}
                            <option value={script.id}>{script.name}</option>
                        {/each}
                    </select>
                    <div class="radio-group">
                        {#each ALL_CHARACTER_CATEGORIES as opt}
                            <label>
                                <input type="checkbox" bind:group={categoryFilter} value={opt}/>
                                {captialiseString(opt)}
                            </label>
                        {/each}
                        <button type="button" class="button-style reset-order-button" onclick={resetCategoryFilter}>Reset</button>
                    </div>
                </div>
                <div class="character-category-column-content">
                    {#each filteredCharacters as character (character.id)}
                        <div class="character-list-item">
                            <button class:in-use={inUseCharacterIds.has(character.id)} onclick={() => onAddCharacter(character.id)}>
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
                <div class="character-category-column-content" role="list">
                    {#each ALL_CHARACTER_CATEGORIES as category}
                        {@const inCat = data.script.characters.filter((c: ScriptCharacter) => c.category === category)}
                        {#if inCat.length > 0}
                            <div style="opacity: 0.6;">{captialiseString(category)} ({inCat.length})</div>
                            {#each inCat as character (character.id)}
                                <div
                                    class="character-list-item drag-row"
                                    class:dragging={dragState?.list === 'script' && dragState?.id === character.id}
                                    data-drop={dropTargetId === character.id && dragState?.list === 'script' ? dropPosition : null}
                                    draggable="true"
                                    role="listitem"
                                    ondragstart={(e) => onDragStart(e, 'script', character.id)}
                                    ondragover={(e) => onDragOverRow(e, 'script', character.id)}
                                    ondrop={(e) => onDropRow(e, 'script', character.id)}
                                    ondragend={clearDrag}
                                >
                                    <button class:in-use={true} onclick={() => onAddCharacter(character.id)}>
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
                <div class="night-section-header">
                    <span>First Night ({firstNightList.length})</span>
                    <button type="button" class="button-style reset-order-button" onclick={() => resetNightOrder('first')}>Reset</button>
                </div>
                <div class="night-list" role="list">
                    {#each firstNightList as character, i (character.id)}
                        <div
                            class="character-list-item drag-row"
                            class:dragging={dragState?.list === 'first' && dragState?.id === character.id}
                            data-drop={dropTargetId === character.id && dragState?.list === 'first' ? dropPosition : null}
                            draggable="true"
                            role="listitem"
                            ondragstart={(e) => onDragStart(e, 'first', character.id)}
                            ondragover={(e) => onDragOverRow(e, 'first', character.id)}
                            ondrop={(e) => onDropRow(e, 'first', character.id)}
                            ondragend={clearDrag}
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

                <div class="night-section-header">
                    <span>Other Nights ({otherNightList.length})</span>
                    <button type="button" class="button-style reset-order-button" onclick={() => resetNightOrder('other')}>Reset</button>
                </div>
                <div class="night-list" role="list">
                    {#each otherNightList as character, i (character.id)}
                        <div
                            class="character-list-item drag-row"
                            class:dragging={dragState?.list === 'other' && dragState?.id === character.id}
                            data-drop={dropTargetId === character.id && dragState?.list === 'other' ? dropPosition : null}
                            draggable="true"
                            role="listitem"
                            ondragstart={(e) => onDragStart(e, 'other', character.id)}
                            ondragover={(e) => onDragOverRow(e, 'other', character.id)}
                            ondrop={(e) => onDropRow(e, 'other', character.id)}
                            ondragend={clearDrag}
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
