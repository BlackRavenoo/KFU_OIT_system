<!--
--- @file +page.svelte
--- Файл представляет страницу контактов.
--- Содержит информацию о контактных данных, расположении и способах связи с ОИТ.
-->

<script lang="ts">
    import pageCSS from './page.css?inline';
    import map from '../../assets/map.webp';
    
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { navigateToForm } from '$lib/utils/setup/navigate';
    import { setupIntersectionObserver, loadStyleContent, cleanupStyleElements, type VisibleElements } from '$lib/utils/setup/page';

    import { onMount, onDestroy } from 'svelte';
    import { fly } from 'svelte/transition';

    /**
     * Объект для отслеживания видимости ключевых элементов страницы
     * @type {VisibleElements}
     */
    let visibleElements: VisibleElements = {
        hero: false,
        contacts: false,
        map: false
    };

    function setVisible(id: string, value: boolean) {
        visibleElements = { ...visibleElements, [id]: value };
    }

    let styleElements: HTMLElement[] = [];
    let observer: IntersectionObserver;

    /**
     * Инициализация страницы при монтировании компонента
     * Загружает стили, настраивает Intersection Observer и устанавливает метаданные страницы
     */
    onMount(() => {
        loadStyleContent(pageCSS, styleElements, 'page-styles');
        observer = setupIntersectionObserver(
            ['hero', 'contacts', 'map'],
            setVisible,
            { threshold: 0, rootMargin: "0px" }
        );

        pageTitle.set('Контакты | Система управления заявками ЕИ КФУ');
        pageDescription.set('Контактная информация Елабужского института Казанского Федерального Университета. Боты, адреса, телефоны, email и время работы.');
        
        setTimeout(() => {
            visibleElements.hero = true;
        }, 100);
    });
    
    /**
     * Очистка ресурсов при уничтожении компонента
     * Удаляет все загруженные стили и восстанавливает метаданные страницы
     */
    onDestroy(() => {
        cleanupStyleElements(styleElements);
        observer?.disconnect();

        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });

</script>

<!---------------->
<!--   HEADER   -->
<!---------------->
<header>
    <div class="header_content" id="hero">
        {#if visibleElements.hero}
            <div class="hero-container" in:fly={{ y: 30, duration: 800, delay: 300 }}>
                <div class="hero-text">
                    <h1>На связи <span class="gradient-text">24/7</span></h1>
                    <p class="hero-description">Отдел информационных технологий всегда готов ответить на ваши вопросы и помочь решить любые технические проблемы.</p>
                    <div class="quick-contacts">
                        <div class="quick-contact-item">
                            <div class="contact-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512">
                                    <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z"/>
                                </svg>
                            </div>
                            <a href="https://t.me/">Telegram</a>
                        </div>
                        <div class="quick-contact-item">
                            <div class="contact-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                                    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                                </svg>
                            </div>
                            <a href="https://wa.me/">WhatsApp</a>
                        </div>
                    </div>
                    <button class="promo pulse-animation" on:click={ navigateToForm }>Оставить заявку</button>
                </div>
                <div class="hero-visual">
                    <div class="contact-circles">
                        <div class="contact-circle circle-1 floating-animation">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg>
                        </div>
                        <div class="contact-circle circle-2 floating-animation-slow">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/></svg>
                        </div>
                        <div class="contact-circle circle-3 floating-animation">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM93.7 477.9c-21.5-5.9-34.2-28-28.3-49.5l14-51.7c5.9-21.5 28-34.2 49.5-28.3s34.2 28 28.3 49.5l-14 51.7c-5.9 21.5-28 34.2-49.5 28.3zm452.6 0c-21.5 5.9-43.6-6.8-49.5-28.3l-14-51.7c-5.9-21.5 6.8-43.6 28.3-49.5s43.6 6.8 49.5 28.3l14 51.7c5.9 21.5-6.8 43.6-28.3 49.5z"/></svg>
                        </div>
                        <div class="contact-circle circle-4 floating-animation-reverse">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>
                        </div>
                    </div>
                    <div class="blur-circle"></div>
                </div>
            </div>
        {/if}
    </div>
</header>
<main>
    <!---------------->
    <!--  CONTACTS  -->
    <!---------------->
    <div class="contacts" id="contacts">
        {#if visibleElements.contacts}
            <h2 class="section-title" in:fly={{ y: 30, duration: 600 }}>Наши контакты</h2>
            <div class="contacts-container" in:fly={{ y: 40, duration: 800 }}>
                <div class="contact-card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M320 0c17.7 0 32 14.3 32 32V96H472c39.8 0 72 32.2 72 72V440c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V168c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM93.7 477.9c-21.5-5.9-34.2-28-28.3-49.5l14-51.7c5.9-21.5 28-34.2 49.5-28.3s34.2 28 28.3 49.5l-14 51.7c-5.9 21.5-28 34.2-49.5 28.3zm452.6 0c-21.5 5.9-43.6-6.8-49.5-28.3l-14-51.7c-5.9-21.5 6.8-43.6 28.3-49.5s43.6 6.8 49.5 28.3l14 51.7c5.9 21.5-6.8 43.6-28.3 49.5z"/></svg>
                    </span>
                    <h3>Боты</h3>
                    <p>Телеграм: <a href="/">Coming soon...</a></p>
                    <p>WhatsApp: <a href="/">Coming soon...</a></p>
                </div>
                <div class="contact-card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg>
                    </span>
                    <h3>Телефон</h3>
                    <p>Основной: <a href="tel:+79869142780">+7 (986) 914-27-80</a></p>
                    <p>Внутренний: <a href="/contact">111</a></p>
                </div>
                <div class="contact-card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/></svg>
                    </span>
                    <h3>Email</h3>
                    <p>Общий: <a href="mailto:oit.ei@kpfu.ru">oit.ei@kpfu.ru</a></p>
                </div>
                <div class="contact-card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0c17.7 0 32 14.3 32 32V66.7C368.4 80.1 431.9 143.6 445.3 224H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H445.3C431.9 368.4 368.4 431.9 288 445.3V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V445.3C143.6 431.9 80.1 368.4 66.7 288H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H66.7C80.1 143.6 143.6 80.1 224 66.7V32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0 -256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z"/></svg>
                    </span>
                    <h3>Адрес</h3>
                    <p>423600, Республика Татарстан</p>
                    <p>г. Елабуга, ул. Казанская, 89</p>
                    <p>Кабинет 104</p>
                </div>
                <div class="contact-card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z"/></svg>
                    </span>
                    <h3>Время работы</h3>
                    <p>Пн-Пт: 8:00 - 17:00</p>
                    <p>Обед: 12:00 - 13:00</p>
                    <p>Сб-Вс: Выходной</p>
                </div>
            </div>
        {/if}
    </div>
    <!---------------->
    <!--    MAP     -->
    <!---------------->
    <div class="map-section" id="map">
        {#if visibleElements.map}
            <div class="map-container" in:fly={{ y: 30, duration: 800 }}>
                <div class="map-info">
                    <h2>Как нас найти</h2>
                    <p>Отдел Информационных Технологий находится в главном корпусе Елабужского института КФУ на цокольном этаже.</p>
                    <button class="map-btn" on:click={() => window.open('https://yandex.ru/maps/-/CHDnBM5w', '_blank')}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M408 120c0 54.6-73.1 151.9-105.2 192c-7.7 9.6-22 9.6-29.6 0C241.1 271.9 168 174.6 168 120C168 53.7 221.7 0 288 0s120 53.7 120 120zm8 80.4c3.5-6.9 6.7-13.8 9.6-20.6c.5-1.2 1-2.5 1.5-3.7l116-46.4C558.9 123.4 576 135 576 152V422.8c0 9.8-6 18.6-15.1 22.3L416 503V200.4zM137.6 138.3c2.4 14.1 7.2 28.3 12.8 41.5c2.9 6.8 6.1 13.7 9.6 20.6V451.8L32.9 502.7C17.1 509 0 497.4 0 480.4V209.6c0-9.8 6-18.6 15.1-22.3l122.6-49zM327.8 332c13.9-17.4 35.7-45.7 56.2-77V504.3L192 449.4V255c20.5 31.3 42.3 59.6 56.2 77c20.5 25.6 59.1 25.6 79.6 0zM288 152a40 40 0 1 0 0-80 40 40 0 1 0 0 80z"/></svg>
                        Открыть в Яндекс.Картах
                    </button>
                </div>
                <div class="map-image">
                    <img src={map} alt="Карта расположения офиса" />
                </div>
            </div>
        {/if}
    </div>
</main>