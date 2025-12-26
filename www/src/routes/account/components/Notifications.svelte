<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import {
        getSystemNotifications,
        createSystemNotification,
        updateSystemNotification,
        deleteSystemNotification,
        SystemNotificationCategory,
        type SystemNotification
    } from '$lib/utils/notifications/system';

    let loading: boolean = true;
    let notifications: SystemNotification[] = [];

    let newText: string = '';
    let newCategory: SystemNotificationCategory = SystemNotificationCategory.INFO;
    let newActiveUntil: string = '';

    let isAdding: boolean = false;

    let editingId: number | null = null;
    let editText: string = '';
    let editCategory: SystemNotificationCategory = SystemNotificationCategory.INFO;
    let editActiveUntil: string = '';

    let showDeleteModal: boolean = false;
    let deletingNotification: SystemNotification | null = null;

    function startEdit(n: SystemNotification) {
        editingId = n.id;
        editText = n.text ?? '';
        editCategory = n.category;
        editActiveUntil = n.active_until ?? '';
    }

    function cancelEdit() {
        editingId = null;
        editText = '';
        editCategory = SystemNotificationCategory.INFO;
        editActiveUntil = '';
    }

    async function saveEdit() {
        if (editingId == null) return;
        const text = editText.trim();
        if (!text) return;

        try {
            await updateSystemNotification(editingId, {
                text,
                category: editCategory,
                active_until: `${editActiveUntil}:00Z` || null
            });

            const res = await getSystemNotifications();
            if (res.success && Array.isArray(res.data)) notifications = res.data;

            notification('Уведомление обновлено', NotificationType.Success);
            cancelEdit();
        } catch (error: any) {
            notification(error.message || 'Ошибка при обновлении уведомления', NotificationType.Error);
        }
    }

    async function handleAdd() {
        isAdding = true;
        const text = newText.trim();
        if (!text) {
            isAdding = false;
            return;
        }

        try {
            await createSystemNotification({
                text,
                category: newCategory,
                active_until: `${newActiveUntil}:00Z` || null
            });

            const res = await getSystemNotifications();
            if (res.success && Array.isArray(res.data)) notifications = res.data;

            notification('Уведомление создано', NotificationType.Success);
            newText = '';
            newCategory = SystemNotificationCategory.INFO;
            newActiveUntil = '';
        } catch (error: any) {
            notification(error.message || 'Ошибка при создании уведомления', NotificationType.Error);
        } finally {
            isAdding = false;
        }
    }

    function openDelete(n: SystemNotification) {
        deletingNotification = n;
        showDeleteModal = true;
    }

    function closeDelete() {
        deletingNotification = null;
        showDeleteModal = false;
    }

    async function confirmDelete() {
        if (!deletingNotification) return;

        try {
            await deleteSystemNotification(deletingNotification.id);

            const res = await getSystemNotifications();
            if (res.success && Array.isArray(res.data)) notifications = res.data;

            notification('Уведомление удалено', NotificationType.Success);
        } catch (error: any) {
            notification(error.message || 'Ошибка при удалении уведомления', NotificationType.Error);
        } finally {
            closeDelete();
        }
    }

    function categoryLabel(cat: SystemNotificationCategory) {
        switch (cat) {
            case SystemNotificationCategory.INFO: 
            // @ts-ignore
            case "Info": return 'Информация';
            case SystemNotificationCategory.WARNING:
            // @ts-ignore
            case "Warning": return 'Внимание';
            default: return '—';
        }
    }

    onMount(async () => {
        if ($currentUser?.role !== UserRole.Administrator) {
            if (browser) goto('/error?status=403');
            return;
        }
        const res = await getSystemNotifications();
        if (res.success && Array.isArray(res.data)) notifications = res.data;
        loading = false;
    });
</script>

<div class="users-section">
    <h1>Системные уведомления</h1>

    {#if loading}
        <div class="loading-state">
            <div class="loader"></div>
            <p>Загрузка...</p>
        </div>
    {:else}
        <div class="add-user-section">
            <h3>Добавить уведомление</h3>
            <div class="add-user-form">
                <div class="form-group">
                    <label for="newNotificationText">Текст уведомления</label>
                    <div class="input-group">
                        <input
                            id="newNotificationText"
                            type="text"
                            placeholder="Введите текст"
                            bind:value={ newText }
                            class="form-input"
                        />
                    </div>
                </div>
                <div class="form-group form-group-row">
                    <div class="form-group-column">
                        <label for="newNotificationCategory">Категория</label>
                        <select
                            id="newNotificationCategory"
                            bind:value={ newCategory }
                            class="form-input"
                        >
                            <option value={ SystemNotificationCategory.INFO }>Информация</option>
                            <option value={ SystemNotificationCategory.WARNING }>Внимание</option>
                        </select>
                    </div>
                    <div class="form-group-column">
                        <label for="newNotificationActiveUntil">Активно до (опционально)</label>
                        <input
                            id="newNotificationActiveUntil"
                            type="datetime-local"
                            bind:value={ newActiveUntil }
                            class="form-input"
                        />
                    </div>
                </div>
                <button
                    class="btn btn-primary"
                    on:click={ handleAdd }
                    disabled={ isAdding || !newText.trim() }
                >
                    { isAdding ? 'Добавление...' : 'Добавить' }
                </button>
            </div>
        </div>

        <div class="users-list-section">
            <h3>Список уведомлений</h3>
            <div class="users-table-container">
                <table class="users-table">
                    <tbody>
                        {#each notifications as n (n.id)}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info">
                                        <span class="user-name">
                                            {#if editingId === n.id}
                                                <input type="text" bind:value={ editText } class="form-input" />
                                            {:else}
                                                { n.text || '—' }
                                            {/if}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    {#if editingId === n.id}
                                        <select bind:value={ editCategory } class="form-input">
                                            <option value={ SystemNotificationCategory.INFO }>Информация</option>
                                            <option value={ SystemNotificationCategory.WARNING }>Внимание</option>
                                        </select>
                                    {:else}
                                        { categoryLabel(n.category) }
                                    {/if}
                                </td>
                                <td>
                                    {#if editingId === n.id}
                                        <input type="datetime-local" bind:value={ editActiveUntil } class="form-input" />
                                    {:else}
                                        { n.active_until ? n.active_until.replace('T', ' ').slice(0, 16) : '—' }
                                    {/if}
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        {#if editingId === n.id}
                                            <button class="action-btn promote-btn" on:click={ saveEdit } aria-label="Сохранить" disabled={!editText.trim()}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                            </button>
                                            <button class="action-btn demote-btn" on:click={ cancelEdit } aria-label="Отменить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6h12v12"/></svg>
                                            </button>
                                        {:else}
                                            <button class="action-btn promote-btn" on:click={ () => startEdit(n) } aria-label="Редактировать">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                            </button>
                                            <button class="action-btn delete-btn" on:click={ () => openDelete(n) } aria-label="Удалить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1 0 2-2 2H7c-2 0-2-1-2-2V6"/><path d="M8 6V4c0-1 0-2 2-2h4c2 0 2 1 2 2v2"/></svg>
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                        {#if notifications.length === 0}
                            <tr>
                                <td colspan="4" style="padding:2rem; text-align:center;">Список пуст</td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>

        {#if showDeleteModal && deletingNotification}
            <Confirmation
                title="Удаление уведомления"
                message={`Вы уверены, что хотите удалить уведомление "${ deletingNotification.text }"?`}
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
    @import './Notifications.css';
</style>