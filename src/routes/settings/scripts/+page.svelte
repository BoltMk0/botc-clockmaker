<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import type { Character } from "$lib/database/common/types";
    import CustomOverlay from "$lib/components/CustomOverlay.svelte";

    let { data }: { data: {scripts: any[], characters: Character[]} } = $props();


    function selectScript(scriptId: number) {
        location.href = `/settings/scripts/${scriptId}`;
    }

    function deleteScript(scriptId: number) {
        fetch(`?/deleteScript`, { method: 'POST' }).then(response => {
            if (!response.ok) {
                alert('Failed to delete script');
            } else {
                location.reload();
            }
        }).catch(er => {
            alert(`Failed to delete script: ${er}`);
        });
    }

    let deleteActionContent: string | undefined = $state();

</script>


<style>
    .scripts-main {
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        border-radius: 1em;
    }

    .scripts-main-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.3em 1em;
        background-color: var(--theme-bg);
    }

    .scripts-contents {
        padding: 1em;
    }
</style>

<div style="display: flex; justify-content: center; align-items: center; height: 100%; width: 100%; box-sizing: border-box; padding: 2em;">

    
<div class="scripts-main">
    <div class="scripts-main-header">
        <div style="font-size: large;">Scripts</div>
        <CustomOverlay title="Create New Script" buttonTitle="+">
            <form action="?/createScript" method="POST" use:enhance={()=>{
                return async ({result}) => {
                    switch(result.type){
                        case 'success':
                            const id = result.data!.id;
                            if(!id) {
                                alert('Failed to create script: No ID returned');
                                return;
                            }
                            goto(`/settings/scripts/${id}`);
                            break;
                        case 'redirect':
                            // Do nothing, the browser will handle the redirect
                            break;
                        case 'failure':
                            alert(`Failed to create script: ${result.data?.error || 'Unknown error'}`);
                            break;
                        case 'error':
                            alert(`Failed to create script: ${result.error}`);
                            break;
                    }
                }
            }}>
                <div style="display: flex; justify-content: center;">
                    
                <table>
                    <tbody>
                        <tr>
                            <th>Name</th>
                            <td><input name="name" required placeholder="Script Name"/></td>
                        </tr>
                        <tr>
                            <td colspan="2">
                                <button style="width: 100%;" type="submit">Create</button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                </div>

            </form>
        </CustomOverlay>
    </div>
    <div class="scripts-contents">
        <table>
            <tbody>
                <tr>
                    <th>Name</th>
                    <th>Actions</th>
                </tr>
                {#each data.scripts as script(script.id)}
                    <tr>
                        <td style="padding-right: 2em;">{script.name}</td>
                        <td>
                            <button class="button-style" onclick={()=>selectScript(script.id)}>
                                Edit
                            </button>
                            <CustomOverlay title="Confirm Delete" buttonTitle="Delete">
                                <form action="?/deleteScript" method="POST" use:enhance={()=>{
                                    return async ({result}) => {
                                        switch(result.type){
                                            case 'success':
                                                location.reload();
                                                break;
                                            case 'redirect':
                                                // Do nothing, the browser will handle the redirect
                                                break;
                                            case 'failure':
                                                alert(`Failed to delete script: ${result.data?.error || 'Unknown error'}`);
                                                break;
                                            case 'error':
                                                alert(`Failed to delete script: ${result.error}`);
                                                break;
                                        }
                                    }
                                }}>
                                    <input hidden name="id" value={script.id}/>
                                    <div>Are you sure you want to delete this script? This action cannot be undone.</div>
                                    <div style="width: 100%;">
                                    <input bind:value={deleteActionContent} placeholder={`Type '${script.name}' to confirm`} style="width: 100%; text-align: center;"/>
                                    </div>
                                    <button class="button-style" class:error={deleteActionContent === script.name} type="submit" style="width: 100%; margin-top: 0.5em;">
                                        {deleteActionContent === script.name ? 'Confirm Delete' : `Enter '${script.name}' to enable`}
                                    </button>
                                </form>
                            </CustomOverlay>
                        </td>
                    </tr>
                    
                {/each}
            </tbody>
        </table>
    </div>

</div>

</div>