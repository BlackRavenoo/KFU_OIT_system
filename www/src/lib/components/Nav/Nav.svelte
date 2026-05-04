<script lang="ts">
    import KFU_large from '../../../assets/temp_logo.png';
    import KFU from '../../../assets/temp_logo(1).webp';

    import { login, getUserData, requestPasswordRecovery } from '$lib/utils/auth/api/api';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { navigateToForm, navigateToHome } from '$lib/utils/setup/navigate';
    import { formatName } from '$lib/utils/validation/validate';
    import { getEmailError } from '$lib/utils/validation/error_messages';

    import Modal from './Modal.svelte';
    import { UserRole } from '$lib/utils/auth/types';

    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    import { onMount, onDestroy, tick } from 'svelte';
    import { fade } from 'svelte/transition';
    import { getUserNotificationsCount, getUserNotifications, markUserNotificationsAsRead } from '$lib/utils/notifications/api';
    import { type UserNotification, UserNotificationTypeText } from '$lib/utils/notifications/types';

    let isShowModal: boolean = false;
    let modalElement: HTMLElement;
    let captchaComponent: any;
    let loginError: string = '';
    
    let username: string = '';
    let userLogin: string = '';
    let userPassword: string = '';
    let userEmail: string = '';
    let rememberMe: boolean = false;

    let redirectAfterLogin: string | null = null;

    let notificationsCount: number = 0;
    let isNotificationsOpen: boolean = false;
    let notifications: UserNotification[] = [];
    let notificationsLoading: boolean = false;
    let notificationsError: string = '';

    let markingAll: boolean = false;
    let markingOne: Record<string, boolean> = {};

    let isFetchingNewer = false;
    let isFetchingOlder = false;
    let allNewerLoaded = false;
    let allOlderLoaded = false;

    let notificationsListEl: HTMLUListElement | null = null;

    /**
     * Нормализует параметр маршрута, извлекая путь, поисковую строку и хэш, и проверяя, что он ведет на тот же домен.
     * @param {(string | null)} val - Исходное значение параметра маршрута.
     * @returns {(string | null)} Нормализованный путь или null, если параметр некорректен или ведет на другой домен.
     */
    function normalizeRouteParam(val: string | null): string | null {
        if (!val) return null;
        try {
            const base = typeof window !== 'undefined' ? window.location.origin : 'https://local';
            const url = new URL(val, base);
            if (typeof window !== 'undefined' && url.origin !== window.location.origin) return '/';
            const target = `${url.pathname}${url.search}${url.hash}`;
            return target || '/';
        } catch {
            return null;
        }
    }

    /**
     * Реактивный блок, который следит за изменениями URL страницы. 
     * Если в URL есть параметр "action=login" и пользователь не аутентифицирован, отображается модальное окно входа. 
     * Если также указан параметр "route", он сохраняется для перенаправления после успешного входа.
    */
    $: {
        const u = $page?.url;
        if (!u) {
            // нет URL — ничего не делаем
        } else {
            const action = u.searchParams.get('action');
            const route = u.searchParams.get('route');
            if (action === 'login' && !$isAuthenticated) {
                isShowModal = true;
                redirectAfterLogin = normalizeRouteParam(route);
            }
        }
    }

    /**
     * Обработчик события входа. 
     * Проверяет введенные пользователем данные, выполняет проверку капчи (если компонент капчи доступен),
     */
    async function loginHandler() {
        loginError = '';
        if (!userLogin || !userPassword) return;

        if (captchaComponent && typeof captchaComponent.validate === 'function') {
            const captchaToken = await captchaComponent.validate();
            if (!captchaToken) {
                loginError = 'Проверка капчи не пройдена.';
                return;
            } else {
                console.log('Captcha token:', captchaToken);
            }
        }

        try {
            const userData = await login(userLogin, userPassword, rememberMe);

            if (userData && !userData.error) {
                const user = await getUserData();
                if (user) {
                    $currentUser = user;
                    $isAuthenticated = true;
                    isShowModal = false;
                }
                userLogin = '';
                userPassword = '';

                if (redirectAfterLogin) {
                    const target = redirectAfterLogin;
                    redirectAfterLogin = null;
                    goto(target, { replaceState: true });
                }
            } else {
                loginError = userData?.message || 'Неверный логин или пароль.';
            }
        } catch (error) {
            loginError = 'Неверный логин или пароль.';
        }
    }

    /**
     * Обработчик события сброса пароля.
     * Проверяет введенный email, выполняет его валидацию и отправляет запрос на восстановление пароля. 
       В случае ошибок отображает соответствующее сообщение.
    */
    async function resetPasswordHandler() {
        loginError = '';

        const email = userEmail.trim();
        if (!email) {
            loginError = 'Введите email для восстановления пароля.';
            return;
        }

        const emailError = getEmailError(email);
        if (emailError) {
            loginError = emailError;
            return;
        }

        const success = await requestPasswordRecovery(email);
        if (success) {
            userEmail = '';
            isShowModal = false;
        }
    }

    /**
     * Обработчик для кнопки входа в навигационной панели.
    */
    function navLoginHandler() {
        isShowModal = true;
    }

    /**
     * Обработчик обновления данных в модальном окне.
     * Получает данные из события и обновляет соответствующие переменные состояния в компоненте.
     * @param {CustomEvent<{ userLogin?: string; userPassword?: string; userEmail?: string; rememberMe?: boolean }>} event - 
     * Событие обновления данных модального окна, содержащее новые значения для полей входа, пароля, email и флага "запомнить меня".
     */
    function handleModalUpdate(event: CustomEvent<{ userLogin?: string; userPassword?: string; userEmail?: string; rememberMe?: boolean }>) {
        if ('userLogin' in event.detail) userLogin = event.detail.userLogin ?? '';
        if ('userPassword' in event.detail) userPassword = event.detail.userPassword ?? '';
        if ('userEmail' in event.detail) userEmail = event.detail.userEmail ?? '';
        if ('rememberMe' in event.detail) rememberMe = event.detail.rememberMe ?? false;
    }

    /**
     * Обработчик закрытия модального окна. Устанавливает флаг отображения модального окна в false, скрывая его.
     */
    function handleModalClose() {
        isShowModal = false;
    }

    /**
     * Функция для получения количества непрочитанных уведомлений пользователя.
     */
    async function fetchNotificationsCount() {
        if (!$isAuthenticated) {
            notificationsCount = 0;
            return;
        }
        try {
            notificationsCount = await getUserNotificationsCount();
        } catch { }
    }

    /**
     * Функция для открытия панели уведомлений. Загружает уведомления пользователя, обрабатывает состояние загрузки и ошибки, 
     * и прокручивает список уведомлений к последнему элементу после загрузки.
     */
    async function openNotifications() {
        isNotificationsOpen = true;
        notificationsLoading = true;
        notificationsError = '';
        allNewerLoaded = false;
        allOlderLoaded = false;
        try {
            notifications = await getUserNotifications({ limit: 20 });
            notifications = notifications.sort((a, b) => a.id - b.id);
            notificationsLoading = false;
            await tick();
            scrollToBottomNotifications();
        } catch (e) {
            notificationsError = 'Ошибка загрузки уведомлений';
            notifications = [];
            notificationsLoading = false;
            await tick();
            scrollToBottomNotifications();
        }
    }

    /**
     * Функция для закрытия панели уведомлений. Устанавливает флаг открытия панели в false, скрывая ее.
     */
    function closeNotifications() {
        isNotificationsOpen = false;
    }

    let intervalId: any;

    /**
     * Обработчик клика по кнопке уведомлений. Останавливает распространение события клика и переключает состояние панели уведомлений:
     * если панель открыта, она будет закрыта, и наоборот.
     * @param {MouseEvent} event - Событие клика по кнопке уведомлений.
    */
    function handleNotificationsButtonClick(event: MouseEvent) {
        event.stopPropagation();
        isNotificationsOpen ?
            closeNotifications() :
            openNotifications();
    }

    /**
     * Обработчик клика по документу. Проверяет, был ли клик сделан вне кнопки уведомлений и панели уведомлений, и если да, то закрывает панель уведомлений.
     * @param {MouseEvent} event - Событие клика по документу.
    */
    function handleDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('#notifications-button') && !target.closest('.notifications-dropdown'))
            closeNotifications();
    }

    /**
     * Функция для отметки всех уведомлений как прочитанных. 
     * Получает список непрочитанных уведомлений, отправляет запрос на сервер для их отметки как прочитанных,
     */
    async function markAllAsRead() {
        markingAll = true;
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) {
            markingAll = false;
            return;
        }
        try {
            await markUserNotificationsAsRead(unreadIds);
            notifications = notifications.map(n => n.read ? n : { ...n, read: true });
            notificationsCount = 0;
        } catch (e) { }
        markingAll = false;
    }

    /**
     * Функция для отметки одного уведомления как прочитанного.
     * Получает идентификатор уведомления, отправляет запрос на сервер для его отметки как прочитанного, 
     * и обновляет состояние уведомлений и счетчик непрочитанных уведомлений
     * @param {number} id - Идентификатор уведомления.
     */
    async function markOneAsRead(id: number) {
        markingOne[id] = true;
        try {
            await markUserNotificationsAsRead([id]);
            notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
            notificationsCount = notifications.filter(n => !n.read).length;
        } catch (e) { }
        markingOne[id] = false;
    }

    /**
     * Обработчик клика по уведомлению. Если клик не был на кнопке "Отметить как прочитанное", то выполняет следующие действия:
     * - Отменяет действие по умолчанию для события клика.
     * - Если уведомление не было прочитано, отправляет запрос на сервер для его отметки как прочитанного.
     * - Закрывает панель уведомлений.
     * - Перенаправляет пользователя на страницу заявки, связанной с уведомлением.
     * @param {UserNotification} n - Уведомление, по которому был выполнен клик.
     * @param {MouseEvent | KeyboardEvent} event - Событие клика или клавиши.
     */
    async function handleNotificationClick(n: UserNotification, event: MouseEvent | KeyboardEvent) {
        if ((event.target as HTMLElement).closest('.mark-one-btn')) return;
        event.preventDefault?.();
        !n.read && await markOneAsRead(n.id);
        closeNotifications();
        goto(`/ticket/${n.ticket_id}`).catch(() => {
            window.location.href = `/ticket/${n.ticket_id}`;
        });
    }

    /**
     * Добавление функциональности бесконечной прокрутки к списку уведомлений.
     * При прокрутке к верхней части списка загружаются более старые уведомления, а при прокрутке к нижней части - более новые уведомления.
     * @param {HTMLUListElement} node - Элемент списка уведомлений.
     * @returns {Object} Объект с методом destroy для удаления обработчика события прокрутки при уничтожении компонента.
     */
    function scrollableList(node: HTMLUListElement) {
        notificationsListEl = node;
        /**
         * Обработчик события прокрутки для списка уведомлений. 
         */
        async function onScroll() {
            if (notificationsLoading || notifications.length === 0) return;

            const scrollTop = node.scrollTop;
            const scrollHeight = node.scrollHeight;
            const clientHeight = node.clientHeight;
            const epsilon = 10;

            if (scrollTop <= epsilon && !isFetchingOlder && !allOlderLoaded) {
                isFetchingOlder = true;
                const minId = Math.min(...notifications.map(n => n.id));
                const prevScrollHeight = scrollHeight;
                try {
                    const oldNotifications = await getUserNotifications({ before: minId, limit: 10 });
                    if (oldNotifications.length > 0) {
                        notifications = [
                            ...oldNotifications,
                            ...notifications
                        ].sort((a, b) => a.id - b.id);
                        await tick();
                        node.scrollTop = node.scrollHeight - prevScrollHeight;
                    } else allOlderLoaded = true;
                } catch (e) { }
                isFetchingOlder = false;
            }

            if (scrollTop + clientHeight >= scrollHeight - epsilon && !isFetchingNewer && !allNewerLoaded) {
                isFetchingNewer = true;
                const maxId = Math.max(...notifications.map(n => n.id));
                try {
                    const newNotifications = await getUserNotifications({ after: maxId, limit: 10 });
                    if (newNotifications.length > 0) {
                        notifications = [
                            ...notifications,
                            ...newNotifications
                        ].sort((a, b) => a.id - b.id);
                        await tick();
                    } else allNewerLoaded = true;
                } catch (e) { }
                isFetchingNewer = false;
            }
        }

        node.addEventListener('scroll', onScroll, { passive: true });

        return {
            destroy() {
                node.removeEventListener('scroll', onScroll);
                notificationsListEl = null;
            }
        };
    }

    /**
     * Функция для прокрутки списка уведомлений к последнему элементу. 
     * Использует функцию tick для ожидания обновления DOM перед выполнением прокрутки.
     */
    async function scrollToBottomNotifications() {
        await tick();
        if (notificationsListEl) {
            notificationsListEl.scrollTop = notificationsListEl.scrollHeight;
        } else {
            setTimeout(() => {
                if (notificationsListEl)
                    notificationsListEl.scrollTop = notificationsListEl.scrollHeight;
            }, 0);
        }
    }

    /**
     * Реактивный блок, который следит за состоянием открытия панели уведомлений.
    */
    $: if (isNotificationsOpen) {
        scrollToBottomNotifications();
    }

    /**
     * При монтировании компонента, если пользователь аутентифицирован и не является анонимом, 
     * выполняется функция для получения количества непрочитанных уведомлений. 
     * Также устанавливается интервал для периодического обновления количества уведомлений каждую минуту, 
     * и добавляется обработчик кликов по документу для закрытия панели уведомлений при клике вне ее. 
     * При уничтожении компонента интервал очищается и удаляется обработчик кликов по документу.
    */
    onMount(() => {
        $currentUser && $currentUser.role !== UserRole.Anonymous && fetchNotificationsCount();
        intervalId = setInterval(() => {
            $currentUser && $currentUser.role !== UserRole.Anonymous && fetchNotificationsCount();
        }, 60000);
        document.addEventListener('click', handleDocumentClick);
    });

    /**
     * При уничтожении компонента, если установлен интервал для обновления количества уведомлений, он очищается.
     * Также удаляется обработчик кликов по документу, который был добавлен при монтировании компонента для закрытия панели уведомлений.
    */
    onDestroy(() => {
        if (intervalId) clearInterval(intervalId);
        document.removeEventListener('click', handleDocumentClick);
    });
</script>

<svelte:head>
    <title>{ $pageTitle }</title>
    <meta name="description" content={ $pageDescription }>
</svelte:head>

<nav>
    <div class="logo">
        <button 
            class="logo-btn" 
            aria-label="На главную" 
            on:click={ navigateToHome } 
        >
            <img src="{ KFU_large }" alt="Logo" class="large-logo" />
        </button>
        <button
            class="logo-btn"
            aria-label="Перейти к заявкам"
            on:click={() => window.location.href = '/ticket'}
        >
            <img src="{ KFU }" alt="Logo Small" class="small-logo" />
        </button>
    </div>
    <ul>
        {#if $isAuthenticated && $currentUser && $currentUser.role !== UserRole.Client && $currentUser.role !== UserRole.Anonymous}
            <li><a href="/ticket" class="big nav-link">Заявки</a></li>
        {:else if !$currentUser}
            <li><a href="/#form" class="nav-link" id="form-link" on:click={ navigateToForm }>Оставить заявку</a></li>
        {:else}
            <li><a href="/account?tab=request" class="nav-link">Заявка</a></li>
        {/if}
        {#if $isAuthenticated && $currentUser && $currentUser.role !== UserRole.Anonymous && $currentUser.role !== UserRole.Client}
            <li><a href="/assets" class="big nav-link">Активы</a></li>
        {/if}
        <li><a href="/page" class="big nav-link">Инструкции</a></li>
        {#if !$isAuthenticated || ($currentUser && ($currentUser.role === UserRole.Anonymous || $currentUser.role === UserRole.Client))}
            <li><a href="/contact" class="big nav-link">Контакты</a></li>
        {/if}
        {#if $isAuthenticated}
        <li style="position:relative;">
                {#if $currentUser && $currentUser.role !== UserRole.Anonymous}
                    <button
                        id="notifications-button"
                        aria-label="Уведомления"
                        class="notifications-btn"
                        on:click={ handleNotificationsButtonClick }
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" width="24" height="24">
                            <path d="M18 16v-5a6 6 0 1 0-12 0v5a2 2 0 0 1-2 2h16a2 2 0 0 1-2-2z"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        {#if notificationsCount > 0}
                            <span class="notifications-dot">{ notificationsCount }</span>
                        {/if}
                    </button>
                {/if}
                {#if isNotificationsOpen}
                    <div
                        class="notifications-dropdown-anim notifications-dropdown"
                        transition:fade={{ duration: 180 }}
                    >
                        <div class="dropdown-header">
                            <button
                                class="mark-all-btn"
                                on:click={ markAllAsRead }
                                disabled={ markingAll }
                                title="Отметить все как прочитанные"
                            >
                                {#if markingAll}
                                    <span class="loader"></span>
                                {:else}
                                    Прочитать все
                                {/if}
                            </button>
                        </div>
                        {#if notificationsLoading}
                            <div class="dropdown-loading">Загрузка...</div>
                        {:else if notificationsError}
                            <div class="dropdown-error">{ notificationsError }</div>
                        {:else if notifications.length === 0}
                            <div class="dropdown-empty">Нет уведомлений</div>
                        {:else}
                            <ul class="dropdown-list" use:scrollableList bind:this={notificationsListEl}>
                                {#each notifications as n (n.id)}
                                    <li>
                                        <div
                                            class="dropdown-item { n.read ? 'read' : 'unread' }"
                                            data-notification-id={n.id}
                                            on:click={ e => handleNotificationClick(n, e) }
                                            on:keydown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleNotificationClick(n, e);
                                                }
                                            }}
                                            tabindex="0"
                                            role="button"
                                            aria-label="Открыть уведомление"
                                        >
                                            <div class="item-title">
                                                {#if n.payload && n.payload.type && UserNotificationTypeText[n.payload.type]}
                                                    { UserNotificationTypeText[n.payload.type] }{ n.payload.data.count ? ` (${n.payload.data.count})` : '' }
                                                {:else}
                                                    Уведомление
                                                {/if}
                                            </div>
                                            <div class="item-date">{ new Date(n.created_at).toLocaleString() }</div>
                                            {#if !n.read}
                                                <button
                                                    type="button"
                                                    class="mark-one-btn"
                                                    on:click|stopPropagation={ () => markOneAsRead(n.id) }
                                                    disabled={ markingOne[n.id] }
                                                    title="Отметить как прочитанное"
                                                >
                                                    {#if markingOne[n.id]}
                                                        <span class="loader"></span>
                                                    {:else}
                                                        Прочитано
                                                    {/if}
                                                </button>
                                            {/if}
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                {/if}
            </li>
            <li>
                <a href="/account" class="account">
                    <span class="account-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                    </span>
                    <span class="account-name">{ formatName($currentUser?.name || '') }</span>
                </a>
            </li>
        {:else}
            <li><button class="login-btn" on:click={ navLoginHandler }>Войти</button></li>
        {/if}
    </ul>
</nav>

{#if isShowModal && !$isAuthenticated}
    <Modal
        bind:modalElement
        bind:captchaComponent
        on:login={ loginHandler }
        on:reset={ resetPasswordHandler }
        on:update={ handleModalUpdate }
        on:close={ handleModalClose }
        userLogin={ userLogin }
        userPassword={ userPassword }
        userEmail={ userEmail }
        rememberMe={ rememberMe }
        loginError={ loginError }
    />
{/if}

<style scoped>
    @import './Nav.css';
</style>