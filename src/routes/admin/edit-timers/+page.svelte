<script lang="ts">
    import { goto } from '$app/navigation';

    export let data;

    let config = data.config;


    function onSave(){
        for(let option of config.timerOptions){
            if(option.label === ''){
                option.label = null;
            }
        }
        
        fetch('/admin/api/config', {
            method: 'POST',
            body: JSON.stringify(config),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to save config');
            }
            console.log("Config saved successfully");
            goto('/admin');
        }).catch(error => {
            console.error("Error saving config:", error);
            alert("Error saving config: " + error);
        });
    }
</script>


<div class="main">
    <table>
        <thead>
            <tr>
                <th>Label</th>
                <th>Duration</th>
                <th>Ring Bell When Remaining</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            {#each config.timerOptions as option, index}
                <tr>
                    <td><input bind:value={option.label} type="text" /></td>
                    <td><input bind:value={option.duration} type="number" required/></td>
                    <td><input bind:value={option.ringBellWhenRemaining} type="number" /></td>
                    <td>
                        <button onclick={()=>{config.timerOptions.splice(index, 1); config = config;}}>Delete</button>
                    </td>
                </tr>
            {/each}
            <tr>
                <td colspan="3">
                    <button style="width: 100%;" onclick={()=>{
                        config.timerOptions.push({duration: 0, ringBellWhenRemaining: null, label: null});
                        config = config;
                    }}>Add Timer Option</button>
                </td>
            </tr>
        </tbody>
    </table>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">
        <a class="button-style" href="/admin">Back</a>
        <button class="button-style" onclick={onSave}>Save</button>
    </div>
</div>

<style>
    .main {
        background-color: #555;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th, td {
        border: 1px solid #333;
        padding: 2px 4px;
        text-align: center;
    }

    input {
        width: 100%;
        box-sizing: border-box;
        padding: 5px;
        border: 1px solid #333;
        border-radius: 5px;
        background-color: #777;
        color: white;
    }

    table button {
        padding: 3px 8px;
        font-size: inherit;
        border-radius: 5px;
        border: none;
        background-color: #777;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
    }

</style>

