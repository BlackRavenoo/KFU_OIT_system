<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    
    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    
    import { validateEmail } from '$lib/utils/validation/validate';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { changeRole, deleteUser } from '$lib/utils/admin/users';
    import { UserStatus, type IUserData } from '$lib/utils/auth/types';
    import {
        loadUsersData,
        sendInvitation,
        setUserStatus,
        type UsersState
    } from '$lib/utils/admin/users';
    import { getAvatar } from '$lib/utils/account/avatar';
    
    let users: IUserData[] = [];
    let loading: boolean = true;
    let error: boolean = false;
    let isMobile: boolean = false;
    
    let newUserEmail: string = '';
    let isAddingUser: boolean = false;
    
    let searchQuery: string = '';
    
    let currentPage: number = 1;
    let totalPages: number = 1;
    let itemsPerPage: number = 10;
    
    let showDeleteModal: boolean = false;
    let deletingUser: IUserData | null = null;

    let emailError: string = '';
    let parsedEmails: string[] = [];
    let newEmailsValid: boolean = false;

    let avatarContainers: Map<string, HTMLDivElement> = new Map();
    let loadedAvatars: Set<string> = new Set();
    let loadingAvatars: Set<string> = new Set();

    let showOnlyStaff: boolean = true;
    let previousShowOnlyStaff: boolean = true;

    $: canManageStatus = $currentUser?.role === UserRole.Administrator || $currentUser?.role === UserRole.Moderator;

    /**
     * Парсит строку с одним или несколькими email, разделёнными ";", и проверяет их валидность.
     * @param {string} input - Строка с email для проверки.
     * @returns {{ valid: boolean; emails: string[]; error?: string }} - Результат проверки.
     */
    function parseAndValidateMultipleEmails(input: string): { valid: boolean; emails: string[]; error?: string } {
        const s = input.trim();
        if (s === '') return { valid: false, emails: [], error: 'Введите хотя бы один email' };
        const emails: string[] = [];
        let i = 0;
        const n = s.length;
        while (i < n) {
            let start = i;
            while (i < n && s[i] !== ';') i++;
            let token = s.slice(start, i).trim();
            if (token === '') return { valid: false, emails: [], error: 'Пустой email между разделителями' };
            if (!validateEmail(token)) return { valid: false, emails: [], error: `Неверный email: ${token}` };
            emails.push(token);
            if (i >= n) break;
            if (s[i] === ';') {
                if (i + 1 < n && s[i + 1] === ' ') {
                    if (i + 2 < n && s[i + 2] === ' ')
                        return { valid: false, emails: [], error: 'После ";" разрешён только один пробел' };
                    i += 2;
                } else {
                    i += 1;
                }
                if (i === n) return { valid: false, emails: [], error: 'Строка не должна заканчиваться разделителем ";"' };
            }
        }
        return { valid: true, emails, error: undefined };
    }

    /**
     * Обрабатывает отправку приглашения пользователю. Валидирует каждый email и отображает ошибки при необходимости.
     */
    async function handleSendInvitation() {
        isAddingUser = true;
        emailError = '';
        const parsed = parseAndValidateMultipleEmails(newUserEmail);
        if (!parsed.valid) {
            emailError = parsed.error || 'Неверный формат email';
            isAddingUser = false;
            return;
        }
        const successes: string[] = [];
        const failures: string[] = [];
        for (const e of parsed.emails) {
            try {
                const ok = await sendInvitation(e);
                if (ok) successes.push(e);
                else failures.push(e);
            } catch {
                failures.push(e);
            }
        }
        if (failures.length === 0) {
            newUserEmail = '';
            await loadUsers();
        } else {
            emailError = `Не удалось отправить на: ${failures.join(', ')}`;
        }
        isAddingUser = false;
    }

    /**
     * Обрабатывает изменение статуса пользователя. Сначала обновляет статус в UI, затем отправляет запрос на сервер. 
     * Если запрос не удался, возвращает предыдущий статус.
     * @param {string} userId - Идентификатор пользователя.
     * @param {UserStatus} newStatus - Новый статус пользователя.
     * @throws {Error} Если запрос на сервер завершился с ошибкой.
     */
    async function handleStatusChange(userId: string, newStatus: UserStatus) {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        
        const previousStatus = user.status || UserStatus.Active;
        
        users = users.map(user => 
            user.id === userId 
                ? { ...user, status: newStatus }
                : user
        );
        
        try {
            const success = await setUserStatus(parseInt(userId), newStatus);
            if (!success) {
                users = users.map(user => 
                    user.id === userId 
                        ? { ...user, status: previousStatus }
                        : user
                );
            }
        } catch (error) {
            users = users.map(user => 
                user.id === userId 
                    ? { ...user, status: previousStatus }
                    : user
            );
        }
    }

    /**
     * Загружает список пользователей с сервера с учётом текущих параметров (страница, количество на странице, поиск, фильтр по сотрудникам).
    */
    async function loadUsers() {
        loading = true;
        error = false;

        const state: UsersState = await loadUsersData(
            currentPage, 
            itemsPerPage, 
            searchQuery,
            showOnlyStaff ? UserRole.Programmer : undefined
        );
        users = state.users;
        totalPages = state.totalPages;
        error = state.error;
        loading = false;

        loadedAvatars.clear();
        loadingAvatars.clear();
        
        setTimeout(() => {
            loadAvatars();
        }, 100);
    }

    /**
     * Загружает аватары для всех пользователей, которые ещё не были загружены и для которых есть контейнеры. 
     * @returns {Promise<void>} - Promise, который разрешается после загрузки всех аватаров.
     */
    async function loadAvatars() {
        for (const user of users) {
            if (loadedAvatars.has(user.id) || loadingAvatars.has(user.id)) continue;
            
            const container = avatarContainers.get(user.id);
            if (container)
                await loadAvatarForUser(user.id, container);
        }
    }

    /**
     * Загружает аватар для конкретного пользователя, если он ещё не был загружен и не находится в процессе загрузки.
     * @param {string} id - Идентификатор пользователя.
     * @param {HTMLDivElement} container - Контейнер для отображения аватара.
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
     * Svelte action для управления контейнерами аватаров пользователей. 
     * Автоматически загружает аватар при монтировании и обновляет его при изменении пользователя.
     * @returns {object} - Объект с методами update и destroy для управления жизненным циклом действия.
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
     * Обрабатывает изменение страницы в пагинации. Загружает пользователей для новой страницы, если она валидна и отличается от текущей.
     * @param {number} page - Номер новой страницы.
     */
    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadUsers();
        }
    }

    /**
     * Обрабатывает изменение роли пользователя. Определяет новую роль на основе текущей и направления изменения, 
     * отправляет запрос на сервер и обновляет UI при успешном ответе.
     * @param {string} id - Идентификатор пользователя.
     * @param {boolean} promote - Направление изменения роли (true для повышения, false для понижения).
    */
    async function handleChangeRole(id: string, promote: boolean) {
        const user = users.find(u => u.id === id);
        if (!user) return;

        const ROLE_ORDER = Object.values(UserRole) as unknown as UserRole[];
        const currentIndex = ROLE_ORDER.indexOf(user.role);

        if (currentIndex === -1) return;

        let newRole = user.role;
        newRole = promote && currentIndex < ROLE_ORDER.length - 1 ? 
            ROLE_ORDER[currentIndex + 1] :
            !promote && currentIndex > 0 ? 
            ROLE_ORDER[currentIndex - 1] : 
            ROLE_ORDER[currentIndex];

        const success = await changeRole(id, newRole);
        if (success) {
            users = users.map(u => u.id === id ? { ...u, role: newRole } : u);

            const container = avatarContainers.get(id);
            if (container) {
                loadedAvatars.delete(id);
                loadingAvatars.delete(id);
                await loadAvatarForUser(id, container);
            }
        }
    }

    /**
     * Открывает модальное окно подтверждения удаления пользователя. Устанавливает удаляемого пользователя в состояние и отображает модал.
     * @param {IUserData} user - Пользователь, которого необходимо удалить.
     */
    function openDeleteModal(user: IUserData) {
        deletingUser = user;
        showDeleteModal = true;
    }

    /**
     * Закрывает все модальные окна, связанные с управлением пользователями, и сбрасывает состояние удаляемого пользователя. 
    */
    function closeModals() {
        showDeleteModal = false;
        deletingUser = null;
    }

    /**
     * Отправляет запрос на сервер для удаления пользователя, 
     * и при успешном ответе обновляет список пользователей и очищает связанные с аватаром данные.
    */
    async function handleDeleteUser() {
        if (!deletingUser) return;

        const success = await deleteUser(parseInt(deletingUser.id));
        
        if (success) {
            users = users.filter(user => user.id !== deletingUser?.id);
            avatarContainers.delete(deletingUser.id);
            loadedAvatars.delete(deletingUser.id);
            loadingAvatars.delete(deletingUser.id);
            closeModals();
        }
    }

    /**
     * Обрабатывает выполнение поиска. Сбрасывает текущую страницу на первую и загружает пользователей с учётом нового поискового запроса.
     */
    function handleSearch() {
        currentPage = 1;
        loadUsers();
    }

    /**
     * Обрабатывает изменение размера окна. Устанавливает флаг isMobile в зависимости от ширины окна. 
      Этот флаг используется для адаптации текста кнопок и других элементов интерфейса на мобильных устройствах.
     */
    function handleResize() {
        if (browser) isMobile = window.innerWidth < 768;
    }

    /**
     * Наблюдает за изменением флага showOnlyStaff. 
     * Если он изменился, сбрасывает текущую страницу на первую и перезагружает список пользователей с учётом нового фильтра.
    */
    $: if (showOnlyStaff !== previousShowOnlyStaff) {
        previousShowOnlyStaff = showOnlyStaff;
        currentPage = 1;
        loadUsers();
    }

    /**
     * При монтировании компонента устанавливает слушатель изменения размера окна для адаптивности интерфейса и загружает список пользователей.
    */
    onMount(async () => {
        if (browser) {
            isMobile = window.innerWidth < 768;
            window.addEventListener('resize', handleResize);
        }
        await loadUsers();
    });

    /**
     * При размонтировании компонента удаляет слушатель изменения размера окна и очищает все данные, связанные с аватарами пользователей.
    */
    onDestroy(() => {
        browser && window.removeEventListener('resize', handleResize);
        avatarContainers.clear();
        loadedAvatars.clear();
        loadingAvatars.clear();
    });

    /**
     * Наблюдает за изменением строки ввода новых email для приглашения. 
     * При каждом изменении парсит строку, проверяет валидность каждого email и устанавливает соответствующие флаги и сообщения об ошибках.
    */
    $: {
        const parsed = parseAndValidateMultipleEmails(newUserEmail);
        newEmailsValid = parsed.valid;
        parsedEmails = parsed.emails || [];
        emailError = !parsed.valid && newUserEmail.trim() !== '' ? parsed.error || '' : '';
    }
</script>

<div class="users-section">
    <h1>Управление пользователями</h1>
    
    {#if $currentUser?.role === UserRole.Administrator}
        <div class="add-user-section">
            <h3>Добавить пользователя</h3>
            <div class="add-user-form">
                <div class="form-group">
                    <label for="newUserEmail">Email пользователя</label>
                    <div class="input-group">
                        <input 
                            type="text" 
                            id="newUserEmail" 
                            placeholder="Введите email или несколько через ; (например: a@x.com; b@y.com)" 
                            bind:value={ newUserEmail }
                            class="form-input { emailError ? 'red-border' : '' }"
                        />
                        <button 
                            class="btn btn-primary" 
                            on:click={ handleSendInvitation } 
                            disabled={ isAddingUser || !newUserEmail?.trim() || !newEmailsValid }
                        >
                            { isAddingUser ? 'Отправка...' : isMobile ? 'Отправить' : 'Отправить приглашение' }
                        </button>
                    </div>
                    {#if emailError}
                        <p class="input-error">{ emailError }</p>
                    {/if}
                    <p class="help-text">Можно указать несколько email, разделённых ";"</p>
                </div>
            </div>
        </div>
    {/if}
    
    <div class="users-list-section">
        <h3>Список пользователей</h3>
        
        <div class="filter-controls">
            <div class="toggle-container">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        bind:checked={ showOnlyStaff }
                        class="toggle-checkbox"
                    />
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">{ showOnlyStaff ? 'Только сотрудники' : 'Все пользователи' }</span>
                </label>
            </div>
        </div>
        
        <SearchBar 
            bind:searchQuery
            placeholder="Поиск по имени или email..."
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
        {:else}
            <div class="users-table-container">
                <table class="users-table">
                    <tbody>
                        {#each users as user (user.id)}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info">
                                        <div 
                                            class="avatar-container"
                                            use:setAvatarContainer={ user.id }
                                        ></div>
                                        <span class="user-name">{ user.name || 'Без имени' }</span>
                                    </div>
                                </td>
                                <td class="email-cell">{ user.email }</td>
                                <td class="role-cell">
                                    <span class="role-badge { user.role === UserRole.Administrator ? 'admin-role' : user.role === UserRole.Moderator ? 'moderator-role' : 'user-role' }">
                                        { user.role === UserRole.Administrator ? 'Администратор' : user.role === UserRole.Moderator ? 'Модератор' : user.role === UserRole.Programmer ? 'Сотрудник' : user.role === UserRole.Client ? 'Пользователь' : 'Анонимный' }
                                    </span>
                                </td>
                                {#if canManageStatus && user.role >= UserRole.Programmer}
                                    <td class="status-cell">
                                        <select 
                                            class="role-badge status-badge-select { 'status-' + (user.status || UserStatus.Active) }"
                                            value={ user.status || UserStatus.Active }
                                            on:change={(e: Event) => handleStatusChange(user.id, (e.target as HTMLSelectElement).value as unknown as UserStatus)}
                                        >
                                            <option value={ UserStatus.Active }>Активен</option>
                                            <option value={ UserStatus.Sick }>Больничный</option>
                                            <option value={ UserStatus.Vacation }>Отпуск</option>
                                            <option value={ UserStatus.Busy }>Занят</option>
                                        </select>
                                    </td>
                                {/if}
                                {#if $currentUser?.role === UserRole.Administrator}
                                    <td class="actions-cell">
                                        <div class="actions-container">
                                            {#if user.role !== UserRole.Administrator}
                                                <button 
                                                    class="action-btn promote-btn" 
                                                    on:click={ () => handleChangeRole(user.id, true) }
                                                    title="Повысить роль"
                                                    aria-label="Повысить роль пользователя"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="m18 15-6-6-6 6"/>
                                                    </svg>
                                                </button>
                                            {/if}
                                            
                                            {#if user.role !== UserRole.Anonymous && user.role < UserRole.Moderator}
                                                <button 
                                                    class="action-btn demote-btn" 
                                                    on:click={ () => handleChangeRole(user.id, false) }
                                                    title="Понизить роль"
                                                    aria-label="Понизить роль пользователя"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="m6 9 6 6 6-6"/>
                                                    </svg>
                                                </button>
                                            {/if}
                                            
                                            {#if user.role !== UserRole.Administrator}
                                                <button 
                                                    class="action-btn delete-btn" 
                                                    on:click={ () => openDeleteModal(user) }
                                                    title="Удалить пользователя"
                                                    aria-label="Удалить пользователя"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M3 6h18"/>
                                                        <path d="M19 6v14c0 1 0 2-2 2H7c-2 0-2-1-2-2V6"/>
                                                        <path d="M8 6V4c0-1 0-2 2-2h4c2 0 2 1 2 2v2"/>
                                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                                    </svg>
                                                </button>
                                            {/if}
                                        </div>
                                    </td>
                                {/if}
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
    
    {#if showDeleteModal && deletingUser}
        <Confirmation
            title="Удаление пользователя"
            message={`Вы уверены, что хотите удалить пользователя ${ deletingUser.name || deletingUser.email }?`}
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={ handleDeleteUser }
            onCancel={ closeModals }
        />
    {/if}
</div>

<style>
    @import './Users.css';
</style>