<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { createModel, deleteCategory, deleteModel, updateModel } from '$lib/utils/assets/api';
    import { setupKeydownListener, removeKeydownListener } from '$lib/components/Modal/Modal';
    import type { AssetCategory, AssetModel } from '$lib/utils/assets/types';

    export let model: AssetModel | null = null;
    export let mode: 'create' | 'edit' | 'view' = 'create';
    export let categories: AssetCategory[] = [];
    export let canDelete = false;

    const dispatch = createEventDispatcher<{
        save: void;
        close: void;
        openCategory: void;
        deleteModel: { id: number };
        deleteCategory: { id: number };
    }>();

    let name = model?.name || '';
    let category: number | string = model
        ? (typeof model.category === 'number' ? model.category : model.category.id)
        : '';

    let saving = false;
    let errorMsg = '';
    let deletingModel = false;
    let deletingCategory = false;
    let showDeleteModelModal = false;
    let showDeleteCategoryModal = false;

    const MODEL_NAME_MAX = 128;

    $: isReadonly = mode === 'view';
    $: selectedCategoryId = category ? Number(category) : null;
    $: selectedCategory = selectedCategoryId
        ? categories.find((c) => c.id === selectedCategoryId) ?? null
        : null;
    $: validationErrors = {
        name: !name.trim()
            ? 'Имя модели — обязательное поле'
            : (name.trim().length > MODEL_NAME_MAX ? `Максимум ${ MODEL_NAME_MAX } символов` : ''),
        category: !category ? 'Категория — обязательное поле' : '',
    };
    $: isFormInvalid = Object.values(validationErrors).some((msg) => Boolean(msg));

    function switchToEdit() {
        mode = 'edit';
    }

    async function handleSave() {
        if (isFormInvalid) {
            errorMsg = 'Проверьте корректность заполнения полей';
            return;
        }

        saving = true;
        errorMsg = '';

        try {
            const payload = {
                name: name.trim(),
                category: Number(category),
            };

            const resp = model && mode === 'edit'
                ? await updateModel(model.id, payload)
                : await createModel(payload);

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

    function openDeleteModelModal() {
        showDeleteModelModal = true;
    }

    function closeDeleteModelModal() {
        if (deletingModel) return;
        showDeleteModelModal = false;
    }

    async function handleDeleteModel() {
        if (!model || deletingModel) return;

        deletingModel = true;
        const resp = await deleteModel(model.id);

        if (!resp.success) {
            errorMsg = resp.error || 'Не удалось удалить модель';
            deletingModel = false;
            showDeleteModelModal = false;
            return;
        }

        showDeleteModelModal = false;
        deletingModel = false;
        dispatch('deleteModel', { id: model.id });
    }

    function openDeleteCategoryModal() {
        if (!selectedCategoryId) return;
        showDeleteCategoryModal = true;
    }

    function closeDeleteCategoryModal() {
        if (deletingCategory) return;
        showDeleteCategoryModal = false;
    }

    async function handleDeleteCategory() {
        if (!selectedCategoryId || deletingCategory) return;

        deletingCategory = true;
        const categoryId = selectedCategoryId;
        const resp = await deleteCategory(categoryId);

        if (!resp.success) {
            errorMsg = resp.error || 'Не удалось удалить категорию';
            deletingCategory = false;
            showDeleteCategoryModal = false;
            return;
        }

        showDeleteCategoryModal = false;
        deletingCategory = false;
        dispatch('deleteCategory', { id: categoryId });
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
                    maxlength={ MODEL_NAME_MAX }
                    disabled={ isReadonly }
                />
                {#if validationErrors.name}
                    <span class="field-error">{ validationErrors.name }</span>
                {/if}
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
                {#if validationErrors.category}
                    <span class="field-error">{ validationErrors.category }</span>
                {/if}
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
                {#if canDelete && model}
                    <button class="btn btn-secondary" on:click={ openDeleteModelModal } disabled={ saving || deletingModel || deletingCategory }>
                        Удалить модель
                    </button>
                {/if}
                {#if canDelete && selectedCategoryId}
                    <button class="btn btn-secondary" on:click={ openDeleteCategoryModal } disabled={ saving || deletingModel || deletingCategory }>
                        Удалить категорию
                    </button>
                {/if}
                <button
                    class="btn btn-primary"
                    on:click={ handleSave }
                    disabled={ saving || isFormInvalid }
                >
                    { saving ? 'Сохранение...' : (mode === 'edit' ? 'Сохранить' : 'Создать') }
                </button>
            {/if}
        </div>
    </div>
</div>

{#if showDeleteModelModal && model}
    <Confirmation
        title="Удаление модели"
        message={`Вы уверены, что хотите удалить модель ${ model.name }?`}
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={ handleDeleteModel }
        onCancel={ closeDeleteModelModal }
    />
{/if}

{#if showDeleteCategoryModal && selectedCategory}
    <Confirmation
        title="Удаление категории"
        message={`Вы уверены, что хотите удалить категорию ${ selectedCategory.name }?`}
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={ handleDeleteCategory }
        onCancel={ closeDeleteCategoryModal }
    />
{/if}

<style scoped>
    @import './page.css';
</style>
