<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { buildings } from '$lib/utils/setup/stores';
    import type { Building } from '$lib/utils/tickets/types';
    import { createBuilding, updateBuilding, toggleBuildingActive } from '$lib/utils/admin/buildings';
    import { notification } from '$lib/utils/notifications/notification';
    import { NotificationType } from '$lib/utils/notifications/types';

    let buildingsList: Building[] = [];
    let loading: boolean = true;

    let newName: string = '';
    let newCode: string = '';
    let isAdding: boolean = false;

    let editingId: string | number | null = null;
    let editName: string = '';
    let editCode: string = '';

    let showDeleteModal: boolean = false;
    let deletingBuilding: Building | null = null;

    const unsubscribe = buildings.subscribe(val => buildingsList = Array.isArray(val) ? val : []);

    const CODE_REGEX = /^[A-Z0-9]{1,5}$/;

    /**
     * Санитизация кода: удаление недопустимых символов, преобразование в верхний регистр и обрезка до 5 символов
     * @param {string} value - исходное значение кода
     * @returns {string} - санитизированный код
     */
    function sanitizeCode(value: string) {
        return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    }

    $: newCode = sanitizeCode(newCode);
    $: editCode = sanitizeCode(editCode);
    $: newCodeValid = CODE_REGEX.test(newCode);
    $: editCodeValid = CODE_REGEX.test(editCode);

    /**
     * Проверка прав доступа при монтировании компонента. 
     * Если текущий пользователь не является администратором, перенаправляем на страницу ошибки 403.
    */
    onMount(() => {
        if ($currentUser?.role !== UserRole.Administrator) {
            if (browser) goto('/error?status=403');
            return;
        }
        loading = false;
    });

    /**
     * Отписка от подписки на изменения списка зданий при уничтожении компонента, чтобы избежать утечек памяти.
    */
    onDestroy(() => {
        unsubscribe();
    });

    /**
     * Начало редактирования здания: установка текущего редактируемого здания и заполнение полей для редактирования его данными.
     * @param {Building} b - здание, которое нужно редактировать
     */
    function startEdit(b: Building) {
        editingId = b.id;
        editName = b.name ?? '';
        editCode = String(b.code ?? '');
    }

    /**
     * Отмена редактирования: сброс текущего редактируемого здания и очистка полей для редактирования.
     * При этом изменения, внесенные в поля редактирования, не сохраняются.
     */
    function cancelEdit() {
        editingId = null;
        editName = '';
        editCode = '';
    }

    /**
     * Сохранение изменений при редактировании здания: валидация данных, отправка запроса на обновление, 
     * обновление локального состояния и отображение уведомлений о результате операции.
     * @throws {Error} - если не удалось сохранить здание, выбрасывается ошибка, которая обрабатывается и отображается пользователю.
     */
    async function saveEdit() {
        if (editingId == null) return;
        const name = editName.trim();
        const code = sanitizeCode(editCode.trim());
        if (!name || !CODE_REGEX.test(code)) return;
        const prev = Array.isArray(buildingsList) ? buildingsList.find(b => String(b.id) === String(editingId)) : null;
        try {
            await updateBuilding(editingId, code, name);
            buildings.update(arr => (Array.isArray(arr) ? arr : []).map(b => String(b.id) === String(editingId) ? { ...b, name, code } : b));
            editingId = null;
            editName = '';
            editCode = '';
            notification('Данные здания сохранены', NotificationType.Success);
        } catch (err) {
            notification('Не удалось сохранить здание', NotificationType.Error);
            if (prev) {
                buildings.update(arr => (Array.isArray(arr) ? arr : []).map(b => String(b.id) === String(editingId) ? prev : b));
            }
        }
    }

    /**
     * Добавление нового здания: валидация данных, отправка запроса на создание, 
     * обновление локального состояния и отображение уведомлений о результате операции.
      * @throws {Error} - если не удалось создать здание, выбрасывается ошибка, которая обрабатывается и отображается пользователю.
     */
    async function handleAdd() {
        isAdding = true;
        const name = newName.trim();
        const code = sanitizeCode(newCode.trim());
        if (!name || !CODE_REGEX.test(code)) { isAdding = false; return; }
        try {
            await createBuilding(code, name);
            newName = '';
            newCode = '';
            notification('Здание создано', NotificationType.Success);
        } catch (err) {
            notification('Не удалось создать здание', NotificationType.Error);
        } finally {
            isAdding = false;
        }
    }

    /**
     * Открытие модального окна для подтверждения удаления здания: установка текущего удаляемого здания и отображение модального окна.
     * @param {Building} b - здание, которое нужно удалить
     */
    function openDelete(b: Building) {
        deletingBuilding = b;
        showDeleteModal = true;
    }

    /**
     * Закрытие модального окна для подтверждения удаления здания: сброс текущего удаляемого здания и скрытие модального окна.
     */
    function closeDelete() {
        deletingBuilding = null;
        showDeleteModal = false;
    }

    /**
     * Подтверждение удаления здания: отправка запроса на деактивацию здания, 
     * обновление локального состояния и отображение уведомлений о результате операции.
     * @throws {Error} - если не удалось удалить здание, выбрасывается ошибка, которая обрабатывается и отображается пользователю.
     */
    async function confirmDelete() {
        if (!deletingBuilding) return;
        const id = deletingBuilding.id;
        const prevArr = Array.isArray(buildingsList) ? [...buildingsList] : [];
        closeDelete();
        try {
            await toggleBuildingActive(id, false);
            buildings.update(arr => (Array.isArray(arr) ? arr : []).filter(b => String(b.id) !== String(id)));
            notification('Здание удалено', NotificationType.Success);
        } catch (err) {
            buildings.set(prevArr);
            notification('Не удалось удалить здание', NotificationType.Error);
        }
    }
</script>

<div class="users-section">
    <h1>Управление зданиями</h1>

    {#if loading}
        <div class="loading-state">
            <div class="loader"></div>
            <p>Загрузка...</p>
        </div>
    {:else}
        <div class="add-user-section">
            <h3>Добавить здание</h3>
            <div class="add-user-form">
                <div class="form-group">
                    <label for="newBuildingName">Название здания</label>
                    <div class="input-group">
                        <input
                            id="newBuildingName"
                            type="text"
                            placeholder="Введите название"
                            bind:value={ newName }
                            class="form-input"
                        />
                        <input
                            id="newBuildingCode"
                            type="text"
                            placeholder="Код"
                            bind:value={ newCode }
                            maxlength="5"
                            class="form-input"
                            style="max-width:160px;"
                            on:input={(e) => newCode = sanitizeCode((e.target as HTMLInputElement).value)}
                        />
                        <button
                            class="btn btn-primary"
                            on:click={ handleAdd }
                            disabled={ isAdding || !newName.trim() || !newCodeValid }
                        >
                            { isAdding ? 'Добавление...' : 'Добавить' }
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="users-list-section">
            <h3>Список зданий</h3>
            <div class="users-table-container">
                <table class="users-table">
                    <tbody>
                        {#each buildingsList as b (b.id)}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info" style="gap:1rem;">
                                        <span class="user-name">
                                            {#if editingId === b.id}
                                                <input type="text" bind:value={ editName } class="form-input" />
                                            {:else}
                                                { b.name || '—' }
                                            {/if}
                                        </span>
                                        {#if editingId !== b.id && b.code}
                                            <span class="building-code-mobile" style="display:block; font-size:0.9rem; color:var(--muted, #6b7280);">
                                                { b.code }
                                            </span>
                                        {/if}
                                    </div>
                                </td>
                                <td class="email-cell">
                                    {#if editingId === b.id}
                                        <input
                                            type="text"
                                            bind:value={ editCode }
                                            class="form-input"
                                            placeholder="Код"
                                            maxlength="5"
                                            style="max-width:160px;"
                                            on:input={(e) => editCode = sanitizeCode((e.target as HTMLInputElement).value)}
                                        />
                                    {:else}
                                        <span>{ b.code || '—' }</span>
                                    {/if}
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        {#if editingId === b.id}
                                            <button class="action-btn promote-btn" on:click={ saveEdit } aria-label="Сохранить" disabled={!editName.trim() || !editCodeValid}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                            </button>
                                            <button class="action-btn demote-btn" on:click={ cancelEdit } aria-label="Отменить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6h12v12"/></svg>
                                            </button>
                                        {:else}
                                            <button class="action-btn promote-btn" on:click={() => startEdit(b)} aria-label="Редактировать">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                            </button>
                                            <button class="action-btn delete-btn" on:click={() => openDelete(b)} aria-label="Удалить">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1 0 2-2 2H7c-2 0-2-1-2-2V6"/><path d="M8 6V4c0-1 0-2 2-2h4c2 0 2 1 2 2v2"/></svg>
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                        {#if buildingsList.length === 0}
                            <tr>
                                <td colspan="3" style="padding:2rem; text-align:center;">Список пуст</td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>

        {#if showDeleteModal && deletingBuilding}
            <Confirmation
                title="Удаление здания"
                message={`Вы уверены, что хотите удалить здание ${ deletingBuilding.name }?`}
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
    @import './Buildings.css';
</style>