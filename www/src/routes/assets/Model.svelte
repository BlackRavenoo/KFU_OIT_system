<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { api } from '$lib/utils/api';
    import { setupKeydownListener, removeKeydownListener } from '$lib/components/Modal/Modal';

    type Category = { id: number; name: string; color: string; notes?: string };
    type AssetModel = { id: number; name: string; category: number };

    export let model: AssetModel | null = null;
    export let mode: 'create' | 'edit' | 'view' = 'create';
    export let categories: Category[] = [];

    const dispatch = createEventDispatcher();

    let name = model?.name || '';
    let category: number | string = model?.category ?? '';

    let saving = false;
    let errorMsg = '';

    $: isReadonly = mode === 'view';

    function switchToEdit() {
        mode = 'edit';
    }

    async function handleSave() {
        if (!name.trim()) {
            errorMsg = 'Имя — обязательное поле';
            return;
        }
        if (!category) {
            errorMsg = 'Категория — обязательное поле';
            return;
        }

        saving = true;
        errorMsg = '';

        try {
            const payload = {
                name: name.trim(),
                category: Number(category),
            };

            let resp = model && mode === 'edit' ? 
                await api.put(`/api/v1/assets/models/${model.id}`, payload) :
                await api.post('/api/v1/assets/models', payload);

            if (resp.success) dispatch('save');
            else errorMsg = resp.error || 'Ошибка сохранения';
        } catch (e: any) {
            errorMsg = e?.message || 'Ошибка сохранения';
        } finally {
            saving = false;
        }
    }

    function close() {
        dispatch('close');
    }

    function openCategoryModal() {
        dispatch('openCategory');
    }

    function keydownHandler(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    onMount(() => {
        setupKeydownListener(keydownHandler);
    });

    onDestroy(() => {
        removeKeydownListener(keydownHandler);
    });
</script>

<div
    class="modal-backdrop"
    transition:fade={{ duration: 180 }}
    on:click|self={ close }
    role="presentation"
    style="background: transparent"
>
    <div
        class="modal-window model-modal"
        transition:fly={{ y: 50, duration: 340, easing: quintOut }}
        role="dialog"
        aria-modal="true"
        aria-label={ mode === 'create' ? 'Создание модели' : mode === 'edit' ? 'Редактирование модели' : 'Просмотр модели' }
    >
        <div class="modal-header">
            <h2>
                {#if mode === 'create'}
                    Создание модели
                {:else if mode === 'edit'}
                    Редактирование модели
                {:else}
                    Просмотр модели
                {/if}
            </h2>
            <button class="close-btn" on:click={ close } aria-label="Закрыть">×</button>
        </div>

        {#if errorMsg}
            <div class="modal-error">{ errorMsg }</div>
        {/if}

        <div class="modal-body">
            <label class="field">
                <span class="field-label">Имя модели <span class="required">*</span></span>
                <input
                    type="text"
                    bind:value={ name }
                    placeholder="Название модели"
                    disabled={ isReadonly }
                />
            </label>

            <label class="field">
                <span class="field-label">Категория <span class="required">*</span></span>
                <div class="field-with-action">
                    <select bind:value={ category } disabled={ isReadonly }>
                        <option value="">— Не выбрана —</option>
                        {#each categories as c}
                            <option value={ c.id }>
                                { c.name }
                            </option>
                        {/each}
                    </select>
                    {#if !isReadonly}
                        <button
                            class="inline-add-btn"
                            type="button"
                            on:click={ openCategoryModal }
                            title="Создать категорию"
                            aria-label="Создать категорию"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                                <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    {/if}
                </div>
            </label>

            {#if category}
                {@const selectedCat = categories.find(c => c.id === Number(category))}
                {#if selectedCat}
                    <div class="category-preview" style="border-left: 4px solid { selectedCat.color };">
                        <div class="cat-preview-color" style="background: { selectedCat.color };"></div>
                        <div>
                            <div class="cat-preview-name">{ selectedCat.name }</div>
                            {#if selectedCat.notes}
                                <div class="cat-preview-notes">{ selectedCat.notes }</div>
                            {/if}
                        </div>
                    </div>
                {/if}
            {/if}
        </div>

        <div class="modal-footer">
            {#if isReadonly}
                <button class="btn btn-secondary" on:click={ switchToEdit }>Редактировать</button>
                <button class="btn btn-secondary" on:click={ close }>Закрыть</button>
            {:else}
                <button class="btn btn-secondary" on:click={ close }>Отмена</button>
                <button
                    class="btn btn-primary"
                    on:click={ handleSave }
                    disabled={ saving || !name.trim() || !category }
                >
                    { saving ? 'Сохранение...' : (mode === 'edit' ? 'Сохранить' : 'Создать') }
                </button>
            {/if}
        </div>
    </div>
</div>

<style scoped>
    @import './page.css';
</style>
