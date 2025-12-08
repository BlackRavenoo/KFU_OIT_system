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

    $: canManageStatus = $currentUser?.role === UserRole.Administrator || $currentUser?.role === UserRole.Moderator;

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

    async function loadUsers() {
        loading = true;
        error = false;

        const state: UsersState = await loadUsersData(currentPage, itemsPerPage, searchQuery);
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

    async function loadAvatars() {
        for (const user of users) {
            if (loadedAvatars.has(user.id) || loadingAvatars.has(user.id)) continue;
            
            const container = avatarContainers.get(user.id);
            if (container) {
                await loadAvatarForUser(user.id, container);
            }
        }
    }

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

    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadUsers();
        }
    }

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

    function openDeleteModal(user: IUserData) {
        deletingUser = user;
        showDeleteModal = true;
    }

    function closeModals() {
        showDeleteModal = false;
        deletingUser = null;
    }

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

    function handleSearch() {
        currentPage = 1;
        loadUsers();
    }

    function handleResize() {
        if (browser) isMobile = window.innerWidth < 768;
    }

    onMount(async () => {
        if (browser) {
            isMobile = window.innerWidth < 768;
            window.addEventListener('resize', handleResize);
        }
        await loadUsers();
    });

    onDestroy(() => {
        browser && window.removeEventListener('resize', handleResize);
        avatarContainers.clear();
        loadedAvatars.clear();
        loadingAvatars.clear();
    });

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
                                        { user.role === UserRole.Administrator ? 'Администратор' : user.role === UserRole.Moderator ? 'Модератор' : user.role === UserRole.Programmer ? 'Сотрудник' : 'Пользователь' }
                                    </span>
                                </td>
                                {#if canManageStatus && user.role !== UserRole.Client}
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
                                            
                                            {#if user.role !== UserRole.Client && user.role !== UserRole.Administrator}
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