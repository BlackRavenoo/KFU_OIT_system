<script lang="ts">
    import { onMount } from 'svelte';
    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';

    import { UserRole, type IUserData } from '$lib/utils/auth/types';
    import { loadUsersData } from '$lib/utils/admin/users';
    import { requestAdminTransfer } from '$lib/utils/admin/admin-transfer';
    import { getAvatar } from '$lib/utils/account/avatar';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { handleAuthError } from '$lib/utils/api';

    let users: IUserData[] = [];
    let loading: boolean = true;
    let error: boolean = false;

    let searchQuery: string = '';
    let currentPage: number = 1;
    let totalPages: number = 1;
    let itemsPerPage: number = 10;

    let showConfirmModal: boolean = false;
    let targetUser: IUserData | null = null;
    let isSending: boolean = false;

    let avatarContainers: Map<string, HTMLDivElement> = new Map();
    let loadedAvatars: Set<string> = new Set();
    let loadingAvatars: Set<string> = new Set();

    /**
     * Загрузка пользователей с сервера с учетом текущей страницы, количества элементов на странице и поискового запроса.
     */
    async function loadUsers() {
        loading = true;
        error = false;
        loadedAvatars.clear();
        loadingAvatars.clear();

        const state = await loadUsersData(currentPage, itemsPerPage, searchQuery, UserRole.Programmer);
        users = state.users.filter(u => u.role !== UserRole.Administrator);
        totalPages = state.totalPages;
        error = state.error;
        loading = false;

        setTimeout(() => loadAvatars(), 100);
    }

    /**
     * Загрузка аватаров для отображаемых пользователей. Проходит по списку пользователей и загружает аватар для каждого, 
     * если он еще не был загружен или не находится в процессе загрузки.
     */
    async function loadAvatars() {
        for (const user of users) {
            if (loadedAvatars.has(user.id) || loadingAvatars.has(user.id)) continue;
            const container = avatarContainers.get(user.id);
            if (container) await loadAvatarForUser(user.id, container);
        }
    }

    /**
     * Загрузка аватара для конкретного пользователя. Проверяет, не был ли аватар уже загружен или не находится ли он в процессе загрузки,
     * затем загружает аватар и обновляет состояние загрузки.
     * @param {string} id - ID пользователя, для которого нужно загрузить аватар
     * @param {HTMLDivElement} container - HTML элемент, в который будет загружен аватар
     */
    async function loadAvatarForUser(id: string, container: HTMLDivElement) {
        if (loadedAvatars.has(id) || loadingAvatars.has(id)) return;
        const user = users.find(u => u.id === id);
        if (!user) return;
        loadingAvatars.add(id);
        container.innerHTML = '';
        try {
            await getAvatar(user, container, 36, true);
            loadedAvatars.add(id);
        } finally {
            loadingAvatars.delete(id);
        }
    }

    /**
     * Svelte action для установки контейнера аватара и загрузки аватара при его появлении.
     * @param {HTMLDivElement} node - HTML элемент, который будет использоваться как контейнер для аватара
     * @param {string} userId - ID пользователя, для которого нужно загрузить аватар
     * @returns {Object} - объект с методами для обновления и уничтожения действия
    */
    function setAvatarContainer(node: HTMLDivElement, userId?: string) {
        let currentId = userId;
        if (currentId) {
            avatarContainers.set(currentId, node);
            loadAvatarForUser(currentId, node);
        }
        return {
            update(newUserId?: string) {
                if (newUserId === currentId) return;
                if (currentId) {
                    avatarContainers.delete(currentId);
                    loadedAvatars.delete(currentId);
                    loadingAvatars.delete(currentId);
                }
                currentId = newUserId;
                if (currentId) {
                    avatarContainers.set(currentId, node);
                    loadAvatarForUser(currentId, node);
                }
            },
            destroy() {
                if (currentId) {
                    avatarContainers.delete(currentId);
                    loadedAvatars.delete(currentId);
                    loadingAvatars.delete(currentId);
                }
            }
        };
    }

    /**
     * Обработчик изменения страницы для пагинации
     * @param {number} page - номер страницы, на которую нужно перейти
     */
    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadUsers();
        }
    }

    /**
     * Обработчик поиска пользователей. 
     * Сбрасывает текущую страницу на 1 и загружает пользователей с учетом нового поискового запроса.
     */
    function handleSearch() {
        currentPage = 1;
        loadUsers();
    }

    /**
     * Открывает модальное окно подтверждения передачи прав администратора для выбранного пользователя.
     * @param {IUserData} user - пользователь, для которого нужно подтвердить передачу прав администратора
     */
    function openConfirmModal(user: IUserData) {
        targetUser = user;
        showConfirmModal = true;
    }

    /**
     * Закрывает все модальные окна и сбрасывает состояние выбранного пользователя для передачи прав администратора.
     */
    function closeModals() {
        showConfirmModal = false;
        targetUser = null;
    }

    /**
     * Подтверждает передачу прав администратора выбранному пользователю. 
     * Отправляет запрос на сервер для передачи прав, закрывает модальное окно и обновляет состояние отправки.
     */
    async function confirmTransfer() {
        if (!targetUser) return;
        const userId = targetUser.id;
        isSending = true;
        closeModals();
        await requestAdminTransfer(userId);
        isSending = false;
    }

    /**
     * Получает текстовое представление роли пользователя для отображения в интерфейсе.
     * @param {UserRole} role - роль пользователя
     * @returns {string} - текстовое представление роли
     */
    function getRoleLabel(role: UserRole): string {
        return role === UserRole.Moderator ? 'Модератор' :
               role === UserRole.Programmer ? 'Сотрудник' :
               'Пользователь';
    }

    /**
     * Получает CSS класс для роли пользователя для отображения соответствующего стиля в интерфейсе.
     * @param {UserRole} role - роль пользователя
     * @returns {string} - CSS класс для роли пользователя
     */
    function getRoleClass(role: UserRole): string {
        return role === UserRole.Moderator ? 'moderator-role' :
               role === UserRole.Programmer ? 'employee-role' :
               'user-role';
    }

    /**
     * При монтировании компонента проверяет, является ли текущий пользователь администратором. 
     * Если нет, вызывает обработчик ошибки авторизации.
    */
    onMount(() => {
        if ($currentUser?.role !== UserRole.Administrator) {
            handleAuthError();
            return;
        }
        loadUsers();
    });
</script>

<div class="admin-transfer-section">
    <h1>Передача прав администратора</h1>

    <div class="info-section">
        <h3>Важная информация</h3>
        <p class="info-text">
            Выберите пользователя из списка, которому хотите передать права администратора.
            На его email будет отправлено письмо со ссылкой для подтверждения.
            После подтверждения вы автоматически станете модератором.
        </p>
        <p class="warning-text">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Это действие необратимо — после передачи вы потеряете роль администратора.
        </p>
    </div>

    <div class="users-list-section">
        <h3>Список пользователей</h3>

        <SearchBar
            bind:searchQuery
            placeholder="Поиск пользователей..."
            onSearch={ handleSearch }
        />

        {#if loading}
            <div class="loading-state">
                <div class="loader"></div>
                <p>Загрузка пользователей...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <p>Произошла ошибка при загрузке пользователей</p>
                <button class="btn btn-primary" on:click={ loadUsers }>Попробовать снова</button>
            </div>
        {:else if users.length === 0}
            <div class="empty-state">
                <p>Пользователи не найдены</p>
            </div>
        {:else}
            <div class="users-table-container">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Пользователь</th>
                            <th>Email</th>
                            <th>Роль</th>
                            <th>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each users as user (user.id)}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info">
                                        <div class="avatar-container" use:setAvatarContainer={ user.id }></div>
                                        <span class="user-name">{ user.name }</span>
                                    </div>
                                </td>
                                <td>{ user.email }</td>
                                <td>
                                    <span class="role-badge { getRoleClass(user.role) }">
                                        { getRoleLabel(user.role) }
                                    </span>
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        <button
                                            class="action-btn transfer-btn"
                                            title="Передать права администратора"
                                            aria-label="Передать права администратора"
                                            on:click={ () => openConfirmModal(user) }
                                            disabled={ isSending }
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <polyline points="16 17 21 12 16 7"/>
                                                <line x1="21" y1="12" x2="9" y2="12"/>
                                                <path d="M9 18H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <Pagination
                { currentPage }
                { totalPages }
                onPageChange={ changePage }
            />
        {/if}
    </div>
</div>

{#if showConfirmModal && targetUser}
    <Confirmation
        title="Передача прав администратора"
        message="Вы уверены, что хотите передать права администратора пользователю «{ targetUser.name }»? Вы станете модератором. Это действие необратимо."
        confirmText="Передать"
        cancelText="Отмена"
        onConfirm={ confirmTransfer }
        onCancel={ closeModals }
    />
{/if}

<style>
    @import "./AdminTransfer.css";
</style>
