<!--
--- @file +error.svelte
--- Файл для отображения страницы ошибки
--- Обрабатывает ошибки 404, 403, 401, 400, 414, 413, 301, 500, 502, 503, 504
-->

<script lang="ts">
    import { pageTitle } from '$lib/utils/setup/stores';

    import { onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';
    import { page } from '$app/state';

    /**
     * Определяет видимость элементов на странице ошибки
     * @interface VisibleElements
     */
    interface VisibleElements {
        hero: boolean;
        contacts: boolean;
        map: boolean;
    }

    /**
     * Хранит состояние видимости элементов на странице ошибки
     * @type {VisibleElements}
     */
    let visibleElements: VisibleElements = {
        hero: false,
        contacts: false,
        map: false
    };

    let navComponent: any;
    let styleElements: HTMLElement[] = [];
    
    /**
     * Функция для навигации к форме обратной связи
     */
    function handleNavigateToForm() {
        if (navComponent && navComponent.navigateToFormExternal)
            navComponent.navigateToFormExternal();
    }

    /**
     * Настраивает IntersectionObserver для отслеживания видимости элементов
     * Используется для анимации появления элементов при прокрутке
     */
    function setupIntersectionObserver() {
        const options = {
            threshold: 0.2,
            rootMargin: "0px 0px -100px 0px"
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id as keyof VisibleElements;
                    if (id && id in visibleElements)
                        visibleElements[id] = true;
                }
            });
        }, options);

        ['hero'].forEach(id => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });
    }

    /**
     * Устанавливает заголовок страницы в зависимости от статуса ошибки
     * Настраивает IntersectionObserver для анимации появления элементов
     */
    onMount(() => {
        setupIntersectionObserver();

        pageTitle.set(`Ошибка ${ page.status || '' }`);
        
        setTimeout(() => {
            visibleElements.hero = true;
        }, 100);
    });
    
    /**
     * Удаляет все стили, добавленные на страницу, и восстанавливает заголовок
     */
    onDestroy(() => {
        styleElements.forEach(element => {
            element && element.parentNode && element.parentNode.removeChild(element);
        });
        
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
    });

</script>

<header>
    <div class="header_content" id="hero">
        {#if visibleElements.hero}
            <div class="hero-container" in:fly={{ y: 30, duration: 800, delay: 300 }}>
                <div class="hero-text">
                    {#if page.status === 404}
                        <h1>Страница <span class="gradient-text">не найдена</span></h1>
                        <p class="hero-description">Возможно, адрес был введён с ошибкой или страница была удалена. Проверьте правильность URL или перейдите на главную.</p>
                    {:else if page.status === 403}
                        <h1>Доступ <span class="gradient-text">запрещён</span></h1>
                        <p class="hero-description">У вас недостаточно прав для просмотра запрашиваемой страницы. Если вы уверены, что это ошибка, обратитесь в ОИТ.</p>
                    {:else if page.status === 401}
                        <h1>Ошибка <span class="gradient-text">авторизации</span></h1>
                        <p class="hero-description">Эта страница доступна только для авторизованных пользователей. Пожалуйста, войдите в Ваш аккаунт.</p>
                    {:else if page.status === 400}
                        <h1>В запросе <span class="gradient-text">ошибка</span></h1>
                        <p class="hero-description">Сервер не смог обработать запрос из-за ошибки в синтаксисе. Попробуйте обновить страницу или очистить кеш браузера.</p>
                    {:else if page.status === 414}
                        <h1>URL слишком <span class="gradient-text">длинный</span></h1>
                        <p class="hero-description">Запрашиваемый адрес превышает допустимую длину. Попробуйте сократить URL или используйте другой способ доступа.</p>
                    {:else if page.status === 413}
                        <h1>Запрос слишком <span class="gradient-text">длинный</span></h1>
                        <p class="hero-description">Размер отправляемых данных превышает лимит сервера. Уменьшите объём данных или разделите их на несколько запросов.</p>
                    {:else if page.status === 301}
                        <h1>Эта страница <span class="gradient-text">переехала</span></h1>
                        <p class="hero-description">Страница была перемещена на новый адрес. Сейчас вы будете перенаправлены автоматически, или воспользуйтесь навигацией.</p>
                    {:else if page.status === 500}
                        <h1>Ошибка <span class="gradient-text">сервера</span></h1>
                        <p class="hero-description">Произошла внутренняя ошибка сервера. Мы уже работаем над её устранением. Пожалуйста, попробуйте повторить запрос позже.</p>
                    {:else if page.status === 502}
                        <h1>Ошибка <span class="gradient-text">прокси</span></h1>
                        <p class="hero-description">Произошла внутренняя ошибка сервера. Мы уже работаем над её устранением. Повторите попытку через несколько минут.</p>
                    {:else if page.status === 503}
                        <h1>Сервис временно <span class="gradient-text">недоступен</span></h1>
                        <p class="hero-description">Сервер временно не может обработать ваш запрос из-за технических работ. Пожалуйста, вернитесь позже.</p>
                    {:else if page.status === 504}
                        <h1>Превышено время <span class="gradient-text">ожидания</span></h1>
                        <p class="hero-description">Сервер не смог вовремя получить ответ от другого сервера. Проблема может быть временной, попробуйте обновить страницу.</p>
                    {:else}
                        <h1>Неопознанная <span class="gradient-text">ошибка</span></h1>
                        <p class="hero-description">Произошла непредвиденная ошибка. Пожалуйста, сообщите о ней в ОИТ, указав как вы получили эту ошибку.</p>
                    {/if}
                    <button class="promo pulse-animation" on:click={ handleNavigateToForm }>На главную</button>
                </div>
                <div class="hero-visual">
                    <div class="error-code">
                        {#if page.status === 404}
                            <h1 class="letter">4</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">4</h1>
                        {:else if page.status === 403}
                            <h1 class="letter">4</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">3</h1>
                        {:else if page.status === 401}
                            <h1 class="letter">4</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">1</h1>
                        {:else if page.status === 400}
                            <h1 class="letter">4</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">0</h1>
                        {:else if page.status === 414}
                            <h1 class="letter">4</h1>
                            <h1 class="letter">1</h1>
                            <h1 class="letter">4</h1>
                        {:else if page.status === 413}
                            <h1 class="letter">4</h1>
                            <h1 class="letter">1</h1>
                            <h1 class="letter">3</h1>
                        {:else if page.status === 301}
                            <h1 class="letter">3</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">1</h1>
                        {:else if page.status === 500}
                            <h1 class="letter">5</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">0</h1>
                        {:else if page.status === 502}
                            <h1 class="letter">5</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">2</h1>
                        {:else if page.status === 503}
                            <h1 class="letter">5</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">3</h1>
                        {:else if page.status === 504}
                            <h1 class="letter">5</h1>
                            <h1 class="letter">0</h1>
                            <h1 class="letter">4</h1>
                        {:else}
                            <h1 class="letter">?</h1>
                            <h1 class="letter">?</h1>
                            <h1 class="letter">?</h1>
                        {/if}
                    </div>
                </div>
            </div>
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