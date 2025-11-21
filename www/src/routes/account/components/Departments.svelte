<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { departments } from '$lib/utils/setup/stores';
    import type { Department } from '$lib/utils/tickets/types';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { createDepartment, updateDepartment, toggleDepartmentActive } from '$lib/utils/admin/departments';

    let loading: boolean = true;

    let newName: string = '';
    let isAdding: boolean = false;

    let editingId: string | number | null = null;
    let editName: string = '';

    let showDeleteModal: boolean = false;
    let deletingDepartment: Department | null = null;

    function startEdit(d: Department) {
        editingId = d.id;
        editName = d.name ?? '';
    }

    function cancelEdit() {
        editingId = null;
        editName = '';
    }

    async function saveEdit() {
        if (editingId == null) return;
        const name = editName.trim();
        if (!name) return;

        try {
            await updateDepartment(editingId, name);
            departments.update(arr => (Array.isArray(arr) ? arr : []).map(d => 
                String(d.id) === String(editingId) ? { ...d, name } : d
            ));
            notification('Отдел успешно обновлен', NotificationType.Success);
            editingId = null;
            editName = '';
        } catch (error: any) {
            notification(error.message || 'Ошибка при обновлении отдела', NotificationType.Error);
        }
    }

    async function handleAdd() {
        isAdding = true;
        const name = newName.trim();
        if (!name) { 
            isAdding = false; 
            return; 
        }

        try {
            await createDepartment(name);
            notification('Отдел успешно создан', NotificationType.Success);
            newName = '';
        } catch (error: any) {
            notification(error.message || 'Ошибка при создании отдела', NotificationType.Error);
        } finally {
            isAdding = false;
        }
    }

    function openDelete(d: Department) {
        deletingDepartment = d;
        showDeleteModal = true;
    }

    function closeDelete() {
        deletingDepartment = null;
        showDeleteModal = false;
    }

    async function confirmDelete() {
        if (!deletingDepartment) return;

        try {
            await toggleDepartmentActive(deletingDepartment.id);
            departments.update(arr => (Array.isArray(arr) ? arr : []).filter(d => 
                String(d.id) !== String(deletingDepartment?.id)
            ));
            notification('Отдел успешно деактивирован', NotificationType.Success);
        } catch (error: any) {
            notification(error.message || 'Ошибка при деактивации отдела', NotificationType.Error);
        } finally {
            closeDelete();
        }
    }

    onMount(() => {
        if ($currentUser?.role !== UserRole.Administrator) {
            if (browser) goto('/error?status=403');
            return;
        }
        loading = false;
    });
</script>

<div class="users-section">
    <h1>Управление отделами</h1>

    {#if loading}
        <div class="loading-state">
            <div class="loader"></div>
            <p>Загрузка...</p>
        </div>
    {:else}
        <div class="add-user-section">
            <h3>Добавить отдел</h3>
            <div class="add-user-form">
                <div class="form-group">
                    <label for="newDepartmentName">Название отдела</label>
                    <div class="input-group">
                        <input
                            id="newDepartmentName"
                            type="text"
                            placeholder="Введите название"
                            bind:value={ newName }
                            class="form-input"
                        />
                        <button
                            class="btn btn-primary"
                            on:click={ handleAdd }
                            disabled={ isAdding || !newName.trim() }
                        >
                            { isAdding ? 'Добавление...' : 'Добавить' }
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="users-list-section">
            <h3>Список отделов</h3>
            <div class="users-table-container">
                <table class="users-table">
                    <tbody>
                        {#each $departments as d (d.id)}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info">
                                        <span class="user-name">
                                            {#if editingId === d.id}
                                                <input type="text" bind:value={ editName } class="form-input" />
                                            {:else}
                                                { d.name || '—' }
                                            {/if}
                                        </span>
                                    </div>
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        {#if editingId === d.id}
                                            <button class="action-btn promote-btn" on:click={ saveEdit } aria-label="Сохранить" disabled={!editName.trim()}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                            </button>
                                            <button class="action-btn demote-btn" on:click={ cancelEdit } aria-label="Отменить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6h12v12"/></svg>
                                            </button>
                                        {:else}
                                            <button class="action-btn promote-btn" on:click={() => startEdit(d)} aria-label="Редактировать">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                            </button>
                                            <button class="action-btn delete-btn" on:click={() => openDelete(d)} aria-label="Удалить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1 0 2-2 2H7c-2 0-2-1-2-2V6"/><path d="M8 6V4c0-1 0-2 2-2h4c2 0 2 1 2 2v2"/></svg>
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                        {#if $departments.length === 0}
                            <tr>
                                <td colspan="2" style="padding:2rem; text-align:center;">Список пуст</td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>

        {#if showDeleteModal && deletingDepartment}
            <Confirmation
                title="Удаление отдела"
                message={`Вы уверены, что хотите удалить отдел ${ deletingDepartment.name }?`}
                confirmText="Удалить"
                cancelText="Отмена"
                onConfirm={ confirmDelete }
                onCancel={ closeDelete }
            />
        {/if}
    {/if}
</div>

<style>
    @import './Users.css';
    @import './Departments.css';
</style>