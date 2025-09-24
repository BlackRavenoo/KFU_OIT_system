<script lang="ts">
    import { onMount } from 'svelte';

    import { generateStatisticsReport } from '$lib/utils/admin/statics/report';

    let fromDate: string = '';
    let toDate: string = '';

    let isGeneratingStatistics: boolean = false;

    async function createReport() {
        isGeneratingStatistics = true;
        await generateStatisticsReport(fromDate, toDate);
        isGeneratingStatistics = false;
    }

    onMount(() => {
        const today = new Date().toISOString().split('T')[0];
        fromDate = today;
        toDate = today;
    });
</script>

<div class="statistics-section">
    <h1>Статистика</h1>
    
    <div class="generate-report-section">
        <h3>Формирование отчёта</h3>
        <div class="generate-statistics-form">
            <div class="statistics-row">
                <div class="form-group">
                    <label for="newBotName">С даты</label>
                    <input 
                        type="date" 
                        id="newBotName" 
                        placeholder="С даты" 
                        bind:value={ fromDate }
                        class="form-input"
                    />
                    <label for="newBotName">По дату</label>
                    <input 
                        type="date" 
                        id="newBotName" 
                        placeholder="По дату" 
                        bind:value={ toDate }
                        class="form-input"
                    />
                </div>
                
                <button 
                    class="btn btn-primary" 
                    on:click={ createReport } 
                    disabled={ isGeneratingStatistics || !fromDate.trim() || !toDate.trim() }
                >
                    { isGeneratingStatistics ? 'Формирование...' : 'Сформировать' }
                </button>
            </div>
            <p class="help-text">Сформировать отчёт о количестве выполненных сотрудниками задач</p>
        </div>
    </div>
</div>

<style scoped>
    @import './Statistics.css';
</style>