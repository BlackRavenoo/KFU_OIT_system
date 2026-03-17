<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';

    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { notification } from '$lib/utils/notifications/notification';
    import { NotificationType } from '$lib/utils/notifications/types';
    import { toUiColor, getPaginatedItems } from '$lib/utils/assets/helpers';
    import {
        createStatus,
        deleteStatus,
        getStatuses,
        updateStatus,
    } from '$lib/utils/assets/statuses-api';
    import type { AssetStatus } from '$lib/utils/assets/types';

    const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

    let statuses: AssetStatus[] = [];
    let loading = true;

    let newName = '';
    let newColor = '#3B82F6';
    let isAdding = false;

    let editingId: number | null = null;
    let editName = '';
    let editColor = '#3B82F6';
    let isSaving = false;

    let showDeleteModal = false;
    let deletingStatus: AssetStatus | null = null;

    $: newNameValid = newName.trim().length > 0;
    $: newColorValid = HEX_COLOR_REGEX.test(newColor.trim());
    $: editNameValid = editName.trim().length > 0;
    $: editColorValid = HEX_COLOR_REGEX.test(editColor.trim());

    function normalizeColor(color: string): string {
        const normalized = color.trim().toUpperCase();
        return normalized.startsWith('#') ? normalized : `#${normalized}`;
    }

    async function loadStatuses() {
        loading = true;

        const response = await getStatuses({ page: 1, page_size: 100, sort_order: 'asc' });
        if (!response.success) {
            notification('Не удалось загрузить статусы', NotificationType.Error);
            loading = false;
            return;
        }

        const items = getPaginatedItems(response.data)
            .map((status) => ({ ...status, color: toUiColor(status.color) }))
            .sort((a, b) => a.id - b.id);

        statuses = items;
        loading = false;
    }

    function startEdit(status: AssetStatus) {
        editingId = status.id;
        editName = status.name;
        editColor = normalizeColor(status.color);
    }

    function cancelEdit() {
        editingId = null;
        editName = '';
        editColor = '#3B82F6';
    }

    async function handleAdd() {
        if (!newNameValid || !newColorValid || isAdding) return;

        isAdding = true;

        const response = await createStatus({
            name: newName.trim(),
            color: normalizeColor(newColor),
        });

        if (!response.success) {
            notification('Не удалось создать статус', NotificationType.Error);
            isAdding = false;
            return;
        }

        newName = '';
        newColor = '#3B82F6';
        await loadStatuses();
        notification('Статус создан', NotificationType.Success);
        isAdding = false;
    }

    async function handleSaveEdit() {
        if (editingId === null || !editNameValid || !editColorValid || isSaving) return;

        isSaving = true;

        const response = await updateStatus(editingId, {
            name: editName.trim(),
            color: normalizeColor(editColor),
        });

        if (!response.success) {
            notification('Не удалось обновить статус', NotificationType.Error);
            isSaving = false;
            return;
        }

        await loadStatuses();
        notification('Статус обновлён', NotificationType.Success);
        cancelEdit();
        isSaving = false;
    }

    function openDeleteModal(status: AssetStatus) {
        deletingStatus = status;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        deletingStatus = null;
        showDeleteModal = false;
    }

    async function handleDelete() {
        if (!deletingStatus) return;

        const statusToDelete = deletingStatus;
        closeDeleteModal();

        const response = await deleteStatus(statusToDelete.id);
        if (!response.success) {
            notification('Не удалось удалить статус', NotificationType.Error);
            return;
        }

        statuses = statuses.filter((status) => status.id !== statusToDelete.id);
        if (editingId === statusToDelete.id) cancelEdit();
        notification('Статус удалён', NotificationType.Success);
    }

    onMount(async () => {
        const role = $currentUser?.role;
        if (role !== UserRole.Administrator && role !== UserRole.Moderator) {
            if (browser) goto('/error?status=403');
            return;
        }

        await loadStatuses();
    });
</script>

<div class="users-section">
    <h1>Управление статусами активов</h1>

    <div class="add-user-section">
        <h3>Добавить статус</h3>
        <div class="add-user-form">
            <div class="form-group">
                <label for="newStatusName">Название статуса</label>
                <div class="input-group">
                    <input
                        id="newStatusName"
                        type="text"
                        placeholder="Например: В ремонте"
                        bind:value={ newName }
                        class="form-input"
                    />
                    <div class="color-input-wrapper">
                        <input
                            id="newStatusColor"
                            type="color"
                            bind:value={ newColor }
                            class="color-input"
                            aria-label="Цвет статуса"
                        />
                        <input
                            type="text"
                            bind:value={ newColor }
                            class="form-input color-code-input"
                            placeholder="#3B82F6"
                        />
                    </div>
                    <button
                        class="btn btn-primary"
                        on:click={ handleAdd }
                        disabled={ isAdding || !newNameValid || !newColorValid }
                    >
                        { isAdding ? 'Добавление...' : 'Добавить' }
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="users-list-section">
        <h3>Список статусов</h3>

        {#if loading}
            <div class="loading-state">
                <div class="loader"></div>
                <p>Загрузка...</p>
            </div>
        {:else}
            <div class="users-table-container">
                <table class="users-table">
                    <tbody>
                        {#each statuses as status (status.id)}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info">
                                        <span class="status-color-dot" style="background: {toUiColor(status.color)};"></span>
                                        {#if editingId === status.id}
                                            <input type="text" bind:value={ editName } class="form-input" />
                                        {:else}
                                            <span class="user-name">{ status.name }</span>
                                        {/if}
                                    </div>
                                </td>
                                <td class="email-cell">
                                    {#if editingId === status.id}
                                        <div class="color-input-wrapper edit-color-wrapper">
                                            <input
                                                type="color"
                                                bind:value={ editColor }
                                                class="color-input"
                                                aria-label="Цвет статуса"
                                            />
                                            <input type="text" bind:value={ editColor } class="form-input color-code-input" />
                                        </div>
                                    {:else}
                                        <span class="color-value">{ toUiColor(status.color) }</span>
                                    {/if}
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        {#if editingId === status.id}
                                            <button
                                                class="action-btn promote-btn"
                                                on:click={ handleSaveEdit }
                                                aria-label="Сохранить"
                                                disabled={ isSaving || !editNameValid || !editColorValid }
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                            </button>
                                            <button class="action-btn demote-btn" on:click={ cancelEdit } aria-label="Отменить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6h12v12"/></svg>
                                            </button>
                                        {:else}
                                            <button class="action-btn promote-btn" on:click={ () => startEdit(status) } aria-label="Редактировать">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                            </button>
                                            <button class="action-btn delete-btn" on:click={ () => openDeleteModal(status) } aria-label="Удалить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1 0 2-2 2H7c-2 0-2-1-2-2V6"/><path d="M8 6V4c0-1 0-2 2-2h4c2 0 2 1 2 2v2"/></svg>
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                        {#if statuses.length === 0}
                            <tr>
                                <td colspan="3" style="padding:2rem; text-align:center;">Список пуст</td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>

    {#if showDeleteModal && deletingStatus}
        <Confirmation
            title="Удаление статуса"
            message={`Вы уверены, что хотите удалить статус ${ deletingStatus.name }?`}
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={ handleDelete }
            onCancel={ closeDeleteModal }
        />
    {/if}
</div>

<style>
    @import './Statuses.css';
</style>
