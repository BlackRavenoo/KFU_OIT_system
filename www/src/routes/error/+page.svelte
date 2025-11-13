<script lang="ts">
    import { pageTitle } from '$lib/utils/setup/stores';
    import { type VisibleElements, setupIntersectionObserver } from '$lib/utils/setup/page';

    import { onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';
    import { page } from '$app/stores';
    import { navigateToHome } from '$lib/utils/setup/navigate';
    import { browser } from '$app/environment';

    /**
     * Хранит состояние видимости элементов на странице ошибки
     * @type {VisibleElements}
     */
    let visibleElements: VisibleElements = {
        hero: false
    };

    let observer: IntersectionObserver;

    $: errorStatus = getErrorStatus();

    /**
     * Данные для отображения ошибок
     * @type {Array<{status: number, title: string, description: string}>
     */
    const errorBlocks = [
        {
            status: 404,
            title: 'Страница <span class="gradient-text">не найдена</span>',
            description: 'Возможно, адрес был введён с ошибкой или страница была удалена. Проверьте правильность URL или перейдите на главную.'
        },
        {
            status: 403,
            title: 'Доступ <span class="gradient-text">запрещён</span>',
            description: 'У вас недостаточно прав для просмотра запрашиваемой страницы. Если вы уверены, что это ошибка, обратитесь в ОИТ.'
        },
        {
            status: 401,
            title: 'Ошибка <span class="gradient-text">авторизации</span>',
            description: 'Эта страница доступна только для авторизованных пользователей. Пожалуйста, войдите в Ваш аккаунт.'
        },
        {
            status: 400,
            title: 'В запросе <span class="gradient-text">ошибка</span>',
            description: 'Сервер не смог обработать запрос из-за ошибки в синтаксисе. Попробуйте обновить страницу или очистить кеш браузера.'
        },
        {
            status: 414,
            title: 'URL слишком <span class="gradient-text">длинный</span>',
            description: 'Запрашиваемый адрес превышает допустимую длину. Попробуйте сократить URL или используйте другой способ доступа.'
        },
        {
            status: 413,
            title: 'Запрос слишком <span class="gradient-text">длинный</span>',
            description: 'Размер отправляемых данных превышает лимит сервера. Уменьшите объём данных или разделите их на несколько запросов.'
        },
        {
            status: 301,
            title: 'Эта страница <span class="gradient-text">переехала</span>',
            description: 'Страница была перемещена на новый адрес. Сейчас вы будете перенаправлены автоматически, или воспользуйтесь навигацией.'
        },
        {
            status: 500,
            title: 'Ошибка <span class="gradient-text">сервера</span>',
            description: 'Произошла внутренняя ошибка сервера. Мы уже работаем над её устранением. Пожалуйста, попробуйте повторить запрос позже.'
        },
        {
            status: 502,
            title: 'Ошибка <span class="gradient-text">прокси</span>',
            description: 'Произошла внутренняя ошибка сервера. Мы уже работаем над её устранением. Повторите попытку через несколько минут.'
        },
        {
            status: 503,
            title: 'Сервис временно <span class="gradient-text">недоступен</span>',
            description: 'Сервер временно не может обработать ваш запрос из-за технических работ. Пожалуйста, вернитесь позже.'
        },
        {
            status: 504,
            title: 'Превышено время <span class="gradient-text">ожидания</span>',
            description: 'Сервер не смог вовремя получить ответ от другого сервера. Проблема может быть временной, попробуйте обновить страницу.'
        }
    ];

    const defaultBlock = {
        title: 'Неопознанная <span class="gradient-text">ошибка</span>',
        description: 'Произошла непредвиденная ошибка. Пожалуйста, сообщите о ней в ОИТ, указав как вы получили эту ошибку.'
    };

    /**
     * Получает статус ошибки из URL или объекта страницы
     */
    function getErrorStatus(): number {
        if (browser && $page.url.searchParams) {
            const statusParam = $page.url.searchParams.get('status');
            if (statusParam && !isNaN(Number(statusParam)))
                return Number(statusParam);
        }
        return $page.status || 500;
    }

    /**
     * Получает блок ошибки по статусу
     * @param {number} status - HTTP статус ошибки
     * @returns {Object} - Блок с заголовком и описанием ошибки
     */
    function getErrorBlock(status: number) {
        return errorBlocks.find(b => b.status === status) ?? defaultBlock;
    }

    /**
     * Получает массив цифр из статуса ошибки
     * Используется для отображения кода ошибки в виде цифр
     * @param {number} status - HTTP статус ошибки
     * @returns {string[]} - Массив цифр, представляющих статус
     */
    function getErrorDigits(status: number) {
        const str = status ? String(status).padStart(3, '?') : '???';
        return str.split('');
    }

    /**
     * Устанавливает заголовок страницы в зависимости от статуса ошибки
     * Настраивает IntersectionObserver для анимации появления элементов
     */
     onMount(() => {
        observer = setupIntersectionObserver(['hero'], visibleElements);
        pageTitle.set(`Ошибка ${errorStatus || ''}`);
        
        setTimeout(() => {
            visibleElements.hero = true;
        }, 100);
    });
    
    /**
     * Удаляет все стили, добавленные на страницу, и восстанавливает заголовок
     */
    onDestroy(() => {
        observer?.disconnect();
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
    });

</script>

<header>
    <div class="header_content" id="hero">
        {#if visibleElements.hero}
            {#key errorStatus}
                <div class="hero-container" in:fly={{ y: 30, duration: 800, delay: 300 }}>
                    <div class="hero-text">
                        <h1>{ @html getErrorBlock(errorStatus).title }</h1>
                        <p class="hero-description">{ getErrorBlock(errorStatus).description }</p>
                        <button class="promo pulse-animation" on:click={ navigateToHome }>На главную</button>
                    </div>
                    <div class="hero-visual">
                        <div class="error-code">
                            {#each getErrorDigits(errorStatus) as letter}
                                <h1 class="letter">{ letter }</h1>
                            {/each}
                        </div>
                    </div>
                </div>
            {/key}
        {/if}
    </div>
</header>

<style>
    .hero-container {
        margin: -5rem 0 5rem 0
    }
    
    .error-code {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 10rem;
        font-weight: bold;
        color: var(--blue);
    }
    
    .letter {
        font-size: 20rem;
        font-weight: 900;
        color: var(--blue);
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        animation: float 6s ease-in-out infinite;
    }

    .letter:nth-child(1) {
        animation-delay: 0s;
        position: relative;
        top: -2rem;
        rotate: 10deg;
    }

    .letter:nth-child(2) {
        animation-delay: 1.5s;
        position: relative;
        top: 3rem;
        rotate: 4deg;
    }

    .letter:nth-child(3) {
        animation-delay: 0.9s;
        position: relative;
        top: 1rem;
        rotate: -3deg;
    }

    @media (max-width: 1280px) {
        .hero-visual {
            display: none;
        }

        .hero-container {
            grid-template-columns: 1fr;
        }
    } 
</style>