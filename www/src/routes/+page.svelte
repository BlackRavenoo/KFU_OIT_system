<script lang="ts">
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { setupIntersectionObserver, loadStyleContent, cleanupStyleElements, type VisibleElements } from '$lib/utils/setup/page';
    import { navigateToForm } from '$lib/utils/setup/navigate';
    import { fetchTicket } from '$lib/utils/tickets/api/set';
    import { handleFileChange, removeFile } from '$lib/utils/files/inputs';
    import { showModalWithFocus } from '$lib/components/Modal/Modal';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { buildings } from '$lib/utils/setup/stores';
    import { validateFiles, validateName, validatePhone } from '$lib/utils/setup/validate';
    import { getPublicStats } from '$lib/utils/account/stats';

    import Modal from '$lib/components/Modal/Modal.svelte';
    import pageCSS from './page.css?inline';

    import product from '../assets/product.webp';
    import product_dark from '../assets/product_dark.webp';
    import support from '../assets/support.webp';
    import card1 from '../assets/card_fill_1.webp';
    import card2 from '../assets/card_fill_2.webp';

    import { onMount, onDestroy } from 'svelte';
    import { fade, fly } from 'svelte/transition';

    let moreOptionsVisible: boolean = false;
    let showModal: boolean = false;
    let isDarkTheme: boolean = false;
    
    let Title: string = '';
    let Description: string = '';
    let Name: string = '';
    let Contact: string = '';
    let Building: number;
    let Cabinet: string = '';
    let DateVal: string = '';
    let fileName: string[] = [];
    let File: File[] = [];

    let todayCount: number = 0;
    let totalCount: number = 0;
    let percentOfSolutions: number = 0;
    
    let modalElement: Modal;
    let styleElements: HTMLElement[] = [];
    let observer: IntersectionObserver;
    let themeObserver: MutationObserver;

    /**
     * Объект для отслеживания видимости элементов на странице.
     * @type {VisibleElements}
     */
    let visibleElements: VisibleElements = {
        hero: false,
        steps: false,
        cards: false,
        stats: false,
        form: false
    };

    let touched = {
        Title: false,
        Description: false,
        Name: false,
        Contact: false,
        Building: false
    };

    let errors = {
        Title: '',
        Description: '',
        Name: '',
        Contact: '',
        Building: ''
    };

    let PrivacyConsent: boolean = false;

    $: nameValid = validateName(Name);
    $: phoneValid = validatePhone(Contact);

    /**
     * Обновляет состояние темы на основе класса html элемента
     */
    function updateTheme() {
        isDarkTheme = document.querySelector("html")?.classList.contains("dark") || false;
    }

    /**
     * Проверяет все поля формы и выставляет ошибки.
     * Возвращает true, если ошибок нет.
     */
    function validateForm() {
        errors.Title = Title.trim() === '' ? 'Заполните заголовок' : '';
        errors.Description = Description.trim() === '' ? 'Заполните описание' : '';
        errors.Name = Name.trim() === '' ? 'Введите ФИО' : (!nameValid ? 'Имя должно содержать минимум 3 буквы кириллицей' : '');
        errors.Contact = Contact.trim() === '' ? 'Введите телефон' : (!phoneValid ? 'Некорректный телефон' : '');
        errors.Building = !Building ? 'Выберите здание' : '';
        return Object.values(errors).every(e => e === '');
    }

    /**
     * Функция для обновления видимости элемента по его идентификатору.
     * @param id - Идентификатор элемента.
     * @param value - Новое значение видимости.
     */
    function setVisible(id: string, value: boolean) {
        visibleElements = { ...visibleElements, [id]: value };
    }

    /**
     * Обработчик изменения файла.
     * @param event
     */
    function onFileChange(event: Event) {
        const result = handleFileChange(event, File, fileName, () => {
            showModalWithFocus(
                (val) => showModal = val,
                modalElement,
            )
        });
        File = result.files;
        fileName = result.fileNames;
    }

    /**
     * Обработчик удаления файла по индексу из списка загруженных файлов.
     * @param {number} index - Индекс файла для удаления.
     */
    function onRemoveFile(index: number) {
        const result = removeFile(index, File, fileName);
        File = result.files;
        fileName = result.fileNames;
    }

    /**
     * Обработчик отправки формы.
     * Валидирует все поля, отмечает их как touched, и если ошибок нет — отправляет заявку.
     */
    function onSubmitForm() {
        (Object.keys(touched) as Array<keyof typeof touched>).forEach(k => touched[k] = true);
            
        if (!validateForm() || !validateFiles(File)) return;
        if (!PrivacyConsent) return;

        fetchTicket(Title, Description, Name, Contact, Building, Cabinet, DateVal, File)
            .then(() => {
                Title = '';
                Description = '';
                Name = '';
                Contact = '';
                Building = 0;
                Cabinet = '';
                DateVal = '';
                File = [];
                fileName = [];
                (Object.keys(touched) as Array<keyof typeof touched>).forEach(k => touched[k] = false);
                notification("Заявка отправлена!", NotificationType.Success);
            })
            .catch((error) => {
                notification("Ошибка при отправке заявки", NotificationType.Error);
            });
    }

    /**
     * Загружает статистику с сервера
     */
    async function loadStats() {
        try {
            const stats = await getPublicStats();
            todayCount = stats.todayCount;
            totalCount = stats.totalCount;
            percentOfSolutions = stats.percentOfSolutions;
        } catch (error) {
            console.warn('Не удалось загрузить статистику:', error);
        }
    }

    /**
     * Инициализирует страницу при монтировании компонента.
     * Устанавливает стили, настраивает наблюдатель за пересечением элементов и обновляет метаданные страницы.
    */
    onMount(() => {
        loadStyleContent(pageCSS, styleElements, 'page-styles');
        observer = setupIntersectionObserver(
            ['hero', 'steps', 'cards', 'stats', 'form'],
            setVisible,
            { threshold: 0, rootMargin: "0px" }
        );

        updateTheme();
        loadStats();
        
        themeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.type === 'attributes' && mutation.attributeName === 'class' && updateTheme();
            });
        });

        const htmlElement = document.querySelector('html');
        if (htmlElement) {
            themeObserver.observe(htmlElement, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
        
        pageTitle.set('Главная | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
        
        setTimeout(() => {
            visibleElements.hero = true;
        }, 100);
    });

    /**
     * Удаляет все стили и восстанавливает метаданные страницы при уничтожении компонента.
     */
    onDestroy(() => {
        cleanupStyleElements(styleElements);
        observer?.disconnect();
        themeObserver?.disconnect();
    
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<!---------------->
<!--   HEADER   -->
<!---------------->
<header>
    <div class="header_content" id="hero">
        {#if visibleElements.hero}
            <div class="title" in:fly={{ y: 50, duration: 800, delay: 300 }}>
                <h1>Удобный инструмент <br /> 
                    <span class="gradient-text">для решения Ваших проблем</span>
                </h1>
            </div>
            <div class="banner">
                <div class="description" in:fly={{ x: -50, duration: 800, delay: 600 }}>
                    <p>Система заявок ЕИ КФУ — не просто платформа. Это система обслуживания, созданная с заботой о каждом сотруднике, призванная сделать решение проблем быстрее и проще.</p> 
                    <button class="promo pulse-animation" on:click={ navigateToForm }>Оставить заявку</button>
                </div>
                <div class="image-container" in:fly={{ x: 50, duration: 800, delay: 600 }}>
                    <img src={ isDarkTheme ? product_dark : product } alt="Product Banner" class="floating-animation" />
                    <div class="glow-effect"></div>
                </div>
            </div>
        {/if}
    </div>
</header>

<!-- Остальная часть HTML остается без изменений -->
<main>
    <!---------------->
    <!--    STEPS   -->
    <!---------------->
    <div class="how-it-works" id="steps">
        {#if visibleElements.steps}
            <h2 in:fly={{ y: 30, duration: 600 }}>Как это работает</h2>
            <div class="steps">
                {#each [{num: 1, title: 'Создайте заявку', desc: 'Заполните форму с описанием проблемы'}, 
                       {num: 2, title: 'Ожидайте специалиста', desc: 'Вашей проблемой займутся в ближайшее время'}, 
                       {num: 3, title: 'Получите решение', desc: 'Наши специалисты оперативно решат вашу проблему'}] as step, i}
                    <div class="step" in:fly={{ y: 40, duration: 600, delay: 200 + i*150 }}>
                        <div class="step-icon">{ step.num }</div>
                        <div class="connector" class:last={ i === 2 }></div>
                        <h3>{ step.title }</h3>
                        <p>{ step.desc }</p>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
    <!---------------->
    <!--   CARDS    -->
    <!---------------->
    <div class="cards" id="cards">
        {#if visibleElements.cards}
            <h2 class="section-title" in:fly={{ y: 30, duration: 600 }}>Преимущества нашей системы</h2>
            <div class="cards_row" in:fly={{ y: 40, duration: 800 }}>
                <div class="card hover-effect">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 184.4c-17-15.2-39.4-24.4-64-24.4L64 256c-24.6 0-47 9.2-64 24.4L0 96zM64 288l384 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64zM320 416a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm128-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg> 
                        <span class="icon-text">Систематизированно</span>
                    </span>
                    <h3 class="card_title">Все задачи в одном месте</h3>
                    <div class="card-image-container">
                        <img src="{card1}" alt="card" />
                    </div>
                    <p>Ни одна заявка не останется незамеченной</p>
                </div>
                <div class="card hover-effect">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M88 0C74.7 0 64 10.7 64 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C120.5 112.3 128 119.9 128 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C119.5 47.7 112 40.1 112 24c0-13.3-10.7-24-24-24zM32 192c-17.7 0-32 14.3-32 32L0 416c0 53 43 96 96 96l192 0c53 0 96-43 96-96l16 0c61.9 0 112-50.1 112-112s-50.1-112-112-112l-48 0L32 192zm352 64l16 0c26.5 0 48 21.5 48 48s-21.5 48-48 48l-16 0 0-96zM224 24c0-13.3-10.7-24-24-24s-24 10.7-24 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C232.5 112.3 240 119.9 240 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C231.5 47.7 224 40.1 224 24z"/></svg>
                        <span class="icon-text">Удобно</span>
                    </span>
                    <h3 class="card_title">Интуитивный интерфейс</h3>
                    <div class="card-image-container">
                        <img src="{card2}" alt="card" style="position: relative; top: 10px;" />
                    </div>
                    <p>Простой доступ к заявкам без лишних сложностей</p>
                </div>
            </div>
            <div class="cards_row secondary-row" in:fly={{ y: 40, duration: 800, delay: 200 }}>
                <div class="card hover-effect">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M304 240l0-223.4c0-9 7-16.6 16-16.6C443.7 0 544 100.3 544 224c0 9-7.6 16-16.6 16L304 240zM32 272C32 150.7 122.1 50.3 239 34.3c9.2-1.3 17 6.1 17 15.4L256 288 412.5 444.5c6.7 6.7 6.2 17.7-1.5 23.1C371.8 495.6 323.8 512 272 512C139.5 512 32 404.6 32 272zm526.4 16c9.3 0 16.6 7.8 15.4 17c-7.7 55.9-34.6 105.6-73.9 142.3c-6 5.6-15.4 5.2-21.2-.7L320 288l238.4 0z"/></svg>
                    </span>
                    <h3 class="card_title">Аналитика</h3>
                    <p>Отслеживайте эффективность работы и время решения заявок</p>
                </div>
                <div class="card hover-effect">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M152.1 38.2c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 113C-2.3 103.6-2.3 88.4 7 79s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zm0 160c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 273c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zM224 96c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zm0 160c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zM160 416c0-17.7 14.3-32 32-32l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32zM48 368a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/></svg>
                    </span>
                    <h3 class="card_title">Многоканальность</h3>
                    <p>Оставляйте заявки через сайт, Telegram и WhatsApp</p>
                </div>
                <div class="card hover-effect">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M16 64C16 28.7 44.7 0 80 0L304 0c35.3 0 64 28.7 64 64l0 384c0 35.3-28.7 64-64 64L80 512c-35.3 0-64-28.7-64-64L16 64zM144 448c0 8.8 7.2 16 16 16l64 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-64 0c-8.8 0-16 7.2-16 16zM304 64L80 64l0 320 224 0 0-320z"/></svg>
                    </span>
                    <h3 class="card_title">Мобильность</h3>
                    <p>Доступ к заявкам с любого устройства, где есть интернет</p>
                </div>
            </div>
        {/if}
    </div>
    <!---------------->
    <!--   STATS    -->
    <!---------------->
    <div class="stats" id="stats">
        {#if visibleElements.stats}
            <div class="stats-container" in:fly={{ y: 30, duration: 800 }}>
                <div class="stat">
                    <div class="stat-circle">
                        <h2 class="counter">{ todayCount }</h2>
                    </div>
                    <p>заявок за 24 часа</p>
                </div>
                <div class="stat">
                    <div class="stat-circle">
                        <h2 class="counter">{ totalCount }</h2>
                    </div>
                    <p>решенных проблем</p>
                </div>
                <div class="stat">
                    <div class="stat-circle">
                        <h2 class="counter">{ percentOfSolutions.toFixed(0) }%</h2>
                    </div>
                    <p>проблем решается</p>
                </div>
            </div>
        {/if}
    </div>
    <!---------------->
    <!--    FORM    -->
    <!---------------->
    <div class="form" id="form">
        {#if visibleElements.form}
            <div class="form-content" in:fade={{ duration: 800 }}>
                <img src="{ support }" alt="support" class="support_img">
                <div class="img_container" in:fly={{ x: -50, duration: 800 }}>
                    <img src="{ support }" alt="support" class="floating-animation-slow">
                </div>
                <form on:submit|preventDefault={ onSubmitForm } class="form_container" in:fly={{ x: 50, duration: 800 }}>
                    <h2>Наш отдел спешит на помощь!</h2>
                    <p>Оставьте заявку и мы сделаем всё возможное, чтобы решить Вашу проблему</p>
                    
                    <div class="form-field">
                        <input
                            type="text"
                            id="Title"
                            name="Title"
                            placeholder=" "
                            required
                            bind:value={ Title }
                            class:red-border={ touched.Title && errors.Title }
                            on:input={() => {
                                if (touched.Title) validateForm();
                            }}
                            on:blur={() => { touched.Title = true; validateForm(); }}
                        >
                        <label for="Title">Заголовок заявки</label>
                        {#if touched.Title && errors.Title}
                            <div class="input-error">{errors.Title}</div>
                        {/if}
                    </div>
                    
                    <div class="form-field">
                        <textarea
                            id="Description"
                            name="Description"
                            placeholder=" "
                            required
                            bind:value={ Description }
                            class:red-border={ touched.Description && errors.Description }
                            on:input={() => {
                                if (touched.Description) validateForm();
                            }}
                            on:blur={() => { touched.Description = true; validateForm(); }}
                        ></textarea>
                        <label for="Description">Описание проблемы</label>
                        {#if touched.Description && errors.Description}
                            <div class="input-error">{errors.Description}</div>
                        {/if}
                    </div>
                    
                    <div class="form-row">
                        <div class="form-field">
                            <input
                                type="text"
                                id="Name"
                                name="Name"
                                placeholder=" "
                                required
                                bind:value={ Name }
                                class:red-border={ touched.Name && errors.Name }
                                on:input={() => {
                                    if (touched.Name) validateForm();
                                }}
                                on:blur={() => { touched.Name = true; validateForm(); }}
                            >
                            <label for="Name">ФИО</label>
                            {#if touched.Name && errors.Name}
                                <div class="input-error">{errors.Name}</div>
                            {/if}
                        </div>
                        
                        <div class="form-field">
                            <input
                                type="text"
                                id="Contact"
                                name="Contact"
                                placeholder=" "
                                required
                                bind:value={ Contact }
                                class:red-border={ touched.Contact && errors.Contact }
                                on:input={() => {
                                    if (touched.Contact) validateForm();
                                }}
                                on:blur={() => { touched.Contact = true; validateForm(); }}
                            >
                            <label for="Contact">Контактный телефон</label>
                            {#if touched.Contact && errors.Contact}
                                <div class="input-error">{errors.Contact}</div>
                            {/if}
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-field">
                            <select
                                id="Building"
                                name="Building"
                                class="{ Building ? 'selected' : '' } {touched.Building && errors.Building ? 'red-border' : ''}"
                                placeholder=" "
                                required
                                bind:value={ Building }
                                on:change={() => {
                                    if (touched.Building) validateForm();
                                }}
                                on:blur={() => { touched.Building = true; validateForm(); }}
                            >
                                <option value="" disabled selected>Выберите здание</option>
                                {#each $buildings as building}
                                    <option value={ building.id }>{ building.name }</option>
                                {/each}
                            </select>
                            <label for="Building">Здание</label>
                            {#if touched.Building && errors.Building}
                                <div class="input-error">{errors.Building}</div>
                            {/if}
                        </div>
                        
                        <div class="form-field">
                            <input type="text" id="Cabinet" name="Cabinet" placeholder=" " bind:value={ Cabinet }>
                            <label for="Cabinet">Кабинет</label>
                        </div>
                    </div>
                    
                    <button class="more_options" 
                        on:click|preventDefault={ () => {
                            moreOptionsVisible = !moreOptionsVisible
                        } }
                    >
                        Больше опций <span class="arrow {moreOptionsVisible ? 'arrow_up' : ''}">▼</span>
                    </button>
                    
                    <div class="more { moreOptionsVisible ? 'more_visible' : '' }">
                        <div class="form-field">
                            <input
                                type="datetime-local"
                                id="Date" name="Date"
                                min="2025-06-07T00:00"
                                max="2045-06-14T00:00" 
                                bind:value={ DateVal } />
                            <label for="Date" class="date-label">Желаемые дата и время</label>
                        </div>
                        
                        <div class="file-upload">
                            <input type="file" id="file" multiple accept=".jpg, .jpeg, .png, .pdf" on:change={ onFileChange } />
                            <label for="file">
                                <span class="file-icon">📎</span>
                                Прикрепить файлы ({ File.length }/5)
                            </label>
                            {#if fileName.length > 0}
                                <div class="file-list">
                                    {#each fileName as name, i}
                                        <div class="file-item">
                                            <button class="file-name" on:click={ () => onRemoveFile(i) }>{ name }</button>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="form-row checkbox-field">
                        <label class="checkbox-label">
                            <input 
                                type="checkbox" 
                                id="PrivacyConsent"
                                name="PrivacyConsent"
                                bind:checked={ PrivacyConsent }
                            />
                            <span class="checkmark"></span>
                            Даю согласие на обработку 
                            <a href="/privacy" target="_blank" rel="noopener noreferrer">персональных данных</a>
                        </label>
                    </div>
                    
                    <button class="promo submit-btn" type="submit" disabled={ !PrivacyConsent }>
                        Оставить заявку
                        <span class="btn-arrow">→</span>
                    </button>
                </form>
            </div>
        {/if}
    </div>
</main>

{#if showModal}
    <Modal 
        bind:this={ modalElement } 
        modalMessage="Доступно максимум 5 изображений для загрузки." 
        on:close={ () => showModal = false }
    />
{/if}