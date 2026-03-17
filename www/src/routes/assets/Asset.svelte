<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { createAsset } from '$lib/utils/assets/api';
    import { setupKeydownListener, removeKeydownListener } from '$lib/components/Modal/Modal';
    import { createCategoryMap, getCategoryForModel } from '$lib/utils/assets/helpers';
    import type {
        Asset,
        AssetCategory,
        AssetModel,
        AssetStatus,
    } from '$lib/utils/assets/types';

    export let asset: Asset | null = null;
    export let models: AssetModel[] = [];
    export let statuses: AssetStatus[] = [];
    export let categories: AssetCategory[] = [];

    const dispatch = createEventDispatcher<{
        save: { asset: Asset };
        close: void;
        openModel: void;
    }>();

    let name = asset?.name || '';
    let model_id: number | string = asset?.model_id ?? '';
    let statusId: number | string = asset?.status ?? '';
    let photo: File | null = null;
    let description = asset?.description || '';
    let serial_number = asset?.serial_number || '';
    let inventory_number = asset?.inventory_number || '';
    let location = asset?.location || '';
    let assigned_to = asset?.assigned_to || '';
    let ip = asset?.ip || '';
    let mac = asset?.mac || '';

    let saving = false;
    let errorMsg = '';

    $: categoryMap = createCategoryMap(categories);

    function toOptional(value: string): string | undefined {
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
    }

    async function handleSave() {
        if (!name.trim()) {
            errorMsg = 'Имя — обязательное поле';
            return;
        }
        if (!model_id) {
            errorMsg = 'Модель — обязательное поле';
            return;
        }
        if (!statusId) {
            errorMsg = 'Статус — обязательное поле';
            return;
        }

        saving = true;
        errorMsg = '';

        const normalizedAsset: Asset = {
            id: asset?.id ?? 0,
            name: name.trim(),
            model_id: Number(model_id),
            status: Number(statusId),
            description,
            serial_number,
            inventory_number,
            location,
            assigned_to,
            ip,
            mac,
        };

        if (asset) {
            dispatch('save', { asset: normalizedAsset });
            saving = false;
            return;
        }

        const response = await createAsset({
            name: name.trim(),
            model_id: Number(model_id),
            status: Number(statusId),
            description: toOptional(description),
            serial_number: toOptional(serial_number),
            inventory_number: toOptional(inventory_number),
            location: toOptional(location),
            assigned_to: toOptional(assigned_to),
            ip: toOptional(ip),
            mac: toOptional(mac),
        });

        if (!response.success) {
            errorMsg = response.error || 'Не удалось создать актив';
            saving = false;
            return;
        }

        dispatch('save', {
            asset: {
                ...normalizedAsset,
                id: response.data?.id ?? Date.now(),
            },
        });
        saving = false;
    }

    function close() {
        dispatch('close');
    }

    function openModelModal() {
        dispatch('openModel');
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
>
    <div
        class="modal-window asset-modal"
        transition:fly={{ y: 50, duration: 340, easing: quintOut }}
        role="dialog"
        aria-modal="true"
        aria-label={ asset ? 'Редактирование актива' : 'Создание актива' }
    >
        <div class="modal-header">
            <h2>{ asset ? 'Просмотр / редактирование актива' : 'Создание актива' }</h2>
            <button class="close-btn" on:click={ close } aria-label="Закрыть">×</button>
        </div>

        {#if errorMsg}
            <div class="modal-error">{ errorMsg }</div>
        {/if}

        <div class="modal-body">
            <label class="field">
                <span class="field-label">Имя <span class="required">*</span></span>
                <input type="text" bind:value={ name } placeholder="Название актива" />
            </label>

            <label class="field">
                <span class="field-label">Фото</span>
                <input type="file" accept="image/*" on:change={ e => photo = (e.target as HTMLInputElement)?.files?.[0] ?? null } />
                {#if photo}
                    <img src={ URL.createObjectURL(photo) } alt="Фото актива" style="max-width: 120px; margin-top: 8px; border-radius: 8px;" />
                {/if}
            </label>

            <div class="field-row">
                <label class="field flex-1">
                    <span class="field-label">Модель</span>
                    <div class="field-with-action">
                        <select bind:value={ model_id } required>
                            <option value="">— Не выбрана —</option>
                            {#each models as m}
                                {@const cat = getCategoryForModel(m, categoryMap)}
                                <option value={ m.id }>
                                    { m.name }{ cat ? ` (${ cat.name })` : '' }
                                </option>
                            {/each}
                        </select>
                        <button
                            class="inline-add-btn"
                            type="button"
                            on:click={ openModelModal }
                            title="Создать модель"
                            aria-label="Создать модель"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                                <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                </label>

                <label class="field flex-1">
                    <span class="field-label">Статус</span>
                    <select bind:value={ statusId } required>
                        <option value="">— Не выбран —</option>
                        {#each statuses as s}
                            <option value={ s.id }>{ s.name }</option>
                        {/each}
                    </select>
                </label>
            </div>

            {#if model_id}
                {@const selectedModel = models.find(m => m.id === Number(model_id))}
                {#if selectedModel}
                    {@const cat = getCategoryForModel(selectedModel, categoryMap)}
                    {#if cat}
                        <div class="category-preview" style="border-left: 4px solid { cat.color };">
                            <div class="cat-preview-color" style="background: { cat.color };"></div>
                            <div>
                                <div class="cat-preview-name">{ cat.name }</div>
                                {#if cat.notes}
                                    <div class="cat-preview-notes">{ cat.notes }</div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                {/if}
            {/if}

            <label class="field">
                <span class="field-label">Описание</span>
                <textarea bind:value={ description } placeholder="Описание актива" rows="3"></textarea>
            </label>

            <div class="field-row">
                <label class="field flex-1">
                    <span class="field-label">Серийный номер</span>
                    <input type="text" bind:value={ serial_number } placeholder="S/N" />
                </label>
                <label class="field flex-1">
                    <span class="field-label">Инвентарный номер</span>
                    <input type="text" bind:value={ inventory_number } placeholder="Инв. номер" />
                </label>
            </div>

            <label class="field">
                <span class="field-label">Локация</span>
                <input type="text" bind:value={ location } placeholder="Корпус, кабинет" />
            </label>

            <div class="field-row">
                <label class="field flex-1">
                    <span class="field-label">IP-адрес</span>
                    <input type="text" bind:value={ ip } placeholder="192.168.1.1" />
                </label>
                <label class="field flex-1">
                    <span class="field-label">MAC-адрес</span>
                    <input type="text" bind:value={ mac } placeholder="AA:BB:CC:DD:EE:FF" />
                </label>
            </div>

            <label class="field">
                <span class="field-label">Ответственный сотрудник</span>
                <input type="text" bind:value={ assigned_to } placeholder="ФИО сотрудника" />
            </label>
        </div>

        <div class="modal-footer">
            <button class="btn btn-secondary" on:click={ close }>Отмена</button>
            <button
                class="btn btn-primary"
                on:click={ handleSave }
                disabled={ saving || !name.trim() || !model_id || !statusId }
            >
                { saving ? 'Сохранение...' : (asset ? 'Сохранить' : 'Создать') }
            </button>
        </div>
    </div>
</div>

<style scoped>
    @import './page.css';
</style>
