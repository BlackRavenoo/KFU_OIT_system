<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { createAsset, deleteAsset, updateAsset } from '$lib/utils/assets/api';
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
    export let canDelete = false;

    const dispatch = createEventDispatcher<{
        save: { asset: Asset };
        delete: { id: number };
        close: void;
        openModel: { mode?: 'create' | 'edit'; modelId?: number };
    }>();

    let name = asset?.name || '';
    let model_id: number | string = asset?.model_id ?? '';
    let statusId: number | string = asset?.status ?? '';
    let photo: File | null = null;
    let photoPreviewUrl = '';
    let description = asset?.description || '';
    let serial_number = asset?.serial_number || '';
    let inventory_number = asset?.inventory_number || '';
    let location = asset?.location || '';
    let assigned_to = asset?.assigned_to || '';
    let ip = asset?.ip || '';
    let mac = asset?.mac || '';
    let commission_date = toDateTimeLocal(asset?.commission_date);
    let decommission_date = toDateTimeLocal(asset?.decommission_date);

    let saving = false;
    let errorMsg = '';
    let deleting = false;
    let showDeleteModal = false;

    const NAME_MAX = 256;
    const SERIAL_MAX = 64;
    const INVENTORY_MAX = 64;
    const LOCATION_MAX = 128;
    const ASSIGNED_TO_MAX = 128;

    const macPattern = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

    function normalizeMac(value: string): string {
        const hex = value.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12);
        return hex.match(/.{1,2}/g)?.join(':') ?? '';
    }

    function isValidIp(value: string): boolean {
        const input = value.trim();
        if (!input) return true;

        const ipv4Segment = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
        const ipv4 = new RegExp(`^${ipv4Segment}(?:\\.${ipv4Segment}){3}(?:\\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$`);
        if (ipv4.test(input)) return true;

        const ipv6WithCidr = /^([0-9A-Fa-f:]+)(?:\/(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-8]))?$/;
        return input.includes(':') && ipv6WithCidr.test(input);
    }

    function isValidMac(value: string): boolean {
        const input = value.trim();
        if (!input) return true;
        return macPattern.test(input);
    }

    function toDateTimeLocal(value?: string): string {
        if (!value) return '';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        const pad = (n: number) => String(n).padStart(2, '0');

        return `${ date.getFullYear() }-${ pad(date.getMonth() + 1) }-${ pad(date.getDate()) }T${ pad(date.getHours()) }:${ pad(date.getMinutes()) }`;
    }

    function toOptionalDate(value: string): string | undefined {
        if (!value) return undefined;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return undefined;

        return date.toISOString();
    }

    function toNullableDate(value: string): string | null {
        if (!value) return null;

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;

        return date.toISOString();
    }

    function handleMacInput(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        mac = normalizeMac(input.value);
    }

    function handlePhotoChange(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        photo = input?.files?.[0] ?? null;

        if (photoPreviewUrl) {
            URL.revokeObjectURL(photoPreviewUrl);
            photoPreviewUrl = '';
        }

        if (photo) {
            photoPreviewUrl = URL.createObjectURL(photo);
        }
    }

    $: categoryMap = createCategoryMap(categories);

    $: validationErrors = {
        name: !name.trim()
            ? 'Имя — обязательное поле'
            : (name.trim().length > NAME_MAX ? `Максимум ${ NAME_MAX } символов` : ''),
        model_id: !model_id ? 'Модель — обязательное поле' : '',
        statusId: !statusId ? 'Статус — обязательное поле' : '',
        serial_number: serial_number.trim().length > SERIAL_MAX ? `Максимум ${ SERIAL_MAX } символа` : '',
        inventory_number: inventory_number.trim().length > INVENTORY_MAX ? `Максимум ${ INVENTORY_MAX } символа` : '',
        location: location.trim().length > LOCATION_MAX ? `Максимум ${ LOCATION_MAX } символов` : '',
        assigned_to: assigned_to.trim().length > ASSIGNED_TO_MAX ? `Максимум ${ ASSIGNED_TO_MAX } символов` : '',
        ip: isValidIp(ip) ? '' : 'Некорректный IP-адрес',
        mac: isValidMac(mac) ? '' : 'MAC должен быть в формате AA:BB:CC:DD:EE:FF',
        decommission_date:
            commission_date && decommission_date
                && new Date(decommission_date).getTime() < new Date(commission_date).getTime()
                ? 'Дата списания не может быть раньше даты ввода в эксплуатацию'
                : '',
        photo: photo
            ? (!photo.type.startsWith('image/') ? 'Можно загрузить только изображение'
                : (photo.size === 0 ? 'Файл изображения пустой' : ''))
            : '',
    };

    $: isFormInvalid = Object.values(validationErrors).some((msg) => Boolean(msg));

    function toOptional(value: string): string | undefined {
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
    }

    function toNullable(value: string): string | null {
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
    }

    async function handleSave() {
        if (isFormInvalid) {
            errorMsg = 'Проверьте корректность заполнения полей';
            return;
        }

        saving = true;
        errorMsg = '';

        const normalizedAsset: Asset = {
            id: asset?.id ?? 0,
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
            commission_date: toOptionalDate(commission_date),
            decommission_date: toOptionalDate(decommission_date),
        };

        if (asset) {
            const response = await updateAsset(asset.id, {
                name: name.trim(),
                model_id: Number(model_id),
                status: Number(statusId),
                description: toNullable(description),
                serial_number: toNullable(serial_number),
                inventory_number: toNullable(inventory_number),
                location: toNullable(location),
                assigned_to: toNullable(assigned_to),
                ip: toNullable(ip),
                mac: toNullable(mac),
                commission_date: toNullableDate(commission_date),
                decommission_date: toNullableDate(decommission_date),
                ...(photo ? { photo } : {}),
            });

            if (!response.success) {
                errorMsg = response.error || 'Не удалось обновить актив';
                saving = false;
                return;
            }

            dispatch('save', { asset: normalizedAsset });
            saving = false;
            return;
        }

        const response = await createAsset({
            name: name.trim(),
            model_id: Number(model_id),
            status: Number(statusId),
            ...(photo ? { photo } : {}),
            description: toOptional(description),
            serial_number: toOptional(serial_number),
            inventory_number: toOptional(inventory_number),
            location: toOptional(location),
            assigned_to: toOptional(assigned_to),
            ip: toOptional(ip),
            mac: toOptional(mac),
            commission_date: toOptionalDate(commission_date),
            decommission_date: toOptionalDate(decommission_date),
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
        dispatch('openModel', { mode: 'create' });
    }

    function openEditModelModal() {
        if (!model_id) return;

        dispatch('openModel', {
            mode: 'edit',
            modelId: Number(model_id),
        });
    }

    function openDeleteModal() {
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        if (deleting) return;
        showDeleteModal = false;
    }

    async function handleDelete() {
        if (!asset || deleting) return;

        deleting = true;
        const resp = await deleteAsset(asset.id);

        if (!resp.success) {
            errorMsg = resp.error || 'Не удалось удалить актив';
            deleting = false;
            showDeleteModal = false;
            return;
        }

        showDeleteModal = false;
        deleting = false;
        dispatch('delete', { id: asset.id });
    }

    function keydownHandler(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    onMount(() => {
        setupKeydownListener(keydownHandler);
    });

    onDestroy(() => {
        removeKeydownListener(keydownHandler);

        if (photoPreviewUrl) {
            URL.revokeObjectURL(photoPreviewUrl);
        }
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
                <input type="text" bind:value={ name } maxlength={ NAME_MAX } placeholder="Название актива" />
                {#if validationErrors.name}
                    <span class="field-error">{ validationErrors.name }</span>
                {/if}
            </label>

            <label class="field">
                <span class="field-label">Фото</span>
                <input type="file" accept="image/*" on:change={ handlePhotoChange } />
                {#if photoPreviewUrl}
                    <img src={ photoPreviewUrl } alt="Фото актива" style="max-width: 120px; margin-top: 8px; border-radius: 8px;" />
                {:else if asset?.photo_url}
                    <img src={ asset.photo_url } alt="Фото актива" style="max-width: 120px; margin-top: 8px; border-radius: 8px;" />
                {:else}
                    <div class="asset-photo-placeholder" style="max-width: 120px; margin-top: 8px; height: 86px; border-radius: 8px;">🖼️</div>
                {/if}
                {#if validationErrors.photo}
                    <span class="field-error">{ validationErrors.photo }</span>
                {/if}
            </label>

            <div class="field-row">
                <label class="field flex-1">
                    <span class="field-label">Модель <span class="required">*</span></span>
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
                        {#if model_id && canDelete}
                            <button
                                class="inline-add-btn"
                                type="button"
                                on:click={ openEditModelModal }
                                title="Редактировать/удалить модель"
                                aria-label="Редактировать/удалить модель"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                    <path d="M12 20h9" stroke="currentColor" stroke-width="2" fill="none"/>
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" stroke-width="2" fill="none"/>
                                </svg>
                            </button>
                        {/if}
                    </div>
                    {#if validationErrors.model_id}
                        <span class="field-error">{ validationErrors.model_id }</span>
                    {/if}
                </label>

                <label class="field flex-1">
                    <span class="field-label">Статус <span class="required">*</span></span>
                    <select bind:value={ statusId } required>
                        <option value="">— Не выбран —</option>
                        {#each statuses as s}
                            <option value={ s.id }>{ s.name }</option>
                        {/each}
                    </select>
                    {#if validationErrors.statusId}
                        <span class="field-error">{ validationErrors.statusId }</span>
                    {/if}
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
                    <input type="text" bind:value={ serial_number } maxlength={ SERIAL_MAX } placeholder="S/N" />
                    {#if validationErrors.serial_number}
                        <span class="field-error">{ validationErrors.serial_number }</span>
                    {/if}
                </label>
                <label class="field flex-1">
                    <span class="field-label">Инвентарный номер</span>
                    <input type="text" bind:value={ inventory_number } maxlength={ INVENTORY_MAX } placeholder="Инв. номер" />
                    {#if validationErrors.inventory_number}
                        <span class="field-error">{ validationErrors.inventory_number }</span>
                    {/if}
                </label>
            </div>

            <label class="field">
                <span class="field-label">Локация</span>
                <input type="text" bind:value={ location } maxlength={ LOCATION_MAX } placeholder="Корпус, кабинет" />
                {#if validationErrors.location}
                    <span class="field-error">{ validationErrors.location }</span>
                {/if}
            </label>

            <div class="field-row">
                <label class="field flex-1">
                    <span class="field-label">IP-адрес</span>
                    <input type="text" bind:value={ ip } placeholder="192.168.1.1" />
                    {#if validationErrors.ip}
                        <span class="field-error">{ validationErrors.ip }</span>
                    {/if}
                </label>
                <label class="field flex-1">
                    <span class="field-label">MAC-адрес</span>
                    <input type="text" bind:value={ mac } maxlength="17" placeholder="AA:BB:CC:DD:EE:FF" on:input={ handleMacInput } />
                    {#if validationErrors.mac}
                        <span class="field-error">{ validationErrors.mac }</span>
                    {/if}
                </label>
            </div>

            <label class="field">
                <span class="field-label">Ответственный сотрудник</span>
                <input type="text" bind:value={ assigned_to } maxlength={ ASSIGNED_TO_MAX } placeholder="ФИО сотрудника" />
                {#if validationErrors.assigned_to}
                    <span class="field-error">{ validationErrors.assigned_to }</span>
                {/if}
            </label>

            <div class="field-row">
                <label class="field flex-1">
                    <span class="field-label">Дата ввода в эксплуатацию</span>
                    <input type="datetime-local" bind:value={ commission_date } />
                </label>
                <label class="field flex-1">
                    <span class="field-label">Дата списания</span>
                    <input type="datetime-local" bind:value={ decommission_date } />
                    {#if validationErrors.decommission_date}
                        <span class="field-error">{ validationErrors.decommission_date }</span>
                    {/if}
                </label>
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn btn-secondary" on:click={ close }>Отмена</button>
            {#if asset && canDelete}
                <button
                    class="btn btn-secondary"
                    on:click={ openDeleteModal }
                    disabled={ saving || deleting }
                >
                    Удалить
                </button>
            {/if}
            <button
                class="btn btn-primary"
                on:click={ handleSave }
                disabled={ saving || isFormInvalid }
            >
                { saving ? 'Сохранение...' : (asset ? 'Сохранить' : 'Создать') }
            </button>
        </div>
    </div>
</div>

{#if showDeleteModal && asset}
    <Confirmation
        title="Удаление актива"
        message={`Вы уверены, что хотите удалить актив ${ asset.name }?`}
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={ handleDelete }
        onCancel={ closeDeleteModal }
    />
{/if}

<style scoped>
    @import './page.css';
</style>
