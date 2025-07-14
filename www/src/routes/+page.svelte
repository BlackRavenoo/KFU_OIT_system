<script lang="ts">
    import '../assets/app.css';
    import product from '../assets/product.webp';
    import support from '../assets/support.png';
    import card1 from '../assets/card_filler.svg';
    import card2 from '../assets/card_filler.svg';

    import Nav from '$lib/Nav.svelte';
    import Footer from '$lib/Footer.svelte';

    import { onMount } from 'svelte';
    import { fade, fly } from 'svelte/transition';

    let moreOptionsVisible: boolean = false;
    let pageTitle: string = 'Главная | Система управления заявками ЕИ КФУ';
    let pageDescription: string = 'Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.';

    let Title: string = '';
    let Description: string = '';
    let Name: string = '';
    let Contact: string = '';
    let DateVal: string = '';
    let fileName: string[] = [];
    let File: File[] = [];

    interface VisibleElements {
        hero: boolean;
        steps: boolean;
        cards: boolean;
        stats: boolean;
        form: boolean;
    }

    let visibleElements: VisibleElements = {
        hero: false,
        steps: false,
        cards: false,
        stats: false,
        form: false
    };

    function swapMoreOptions() {
        moreOptionsVisible = !moreOptionsVisible;
    }

    function fetchTicket() {
        console.log('Заявка отправлена:', { Title, Description, Name, Contact, DateVal, File });
    }

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

        ['hero', 'steps', 'cards', 'stats', 'form'].forEach(id => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const newFiles = Array.from(input.files);
            
            if (File.length + newFiles.length > 5) {
                alert('Можно прикрепить максимум 5 файлов');
                return;
            }
            
            File = [...File, ...newFiles];
            fileName = [...fileName, ...newFiles.map(f => f.name)];
        }
    }

    function removeFile(index: number) {
        File = File.filter((_, i) => i !== index);
        fileName = fileName.filter((_, i) => i !== index);
    }

    onMount(() => {
        setupIntersectionObserver();
        
        setTimeout(() => {
            visibleElements.hero = true;
        }, 100);
    });
</script>

<div class="container">
    <slot />

    <!---------------->
    <!--   HEADER   -->
    <!---------------->
    <header>
        <Nav pageTitle={ pageTitle } pageDescription={ pageDescription }/>
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
                        <button class="promo pulse-animation">Оставить заявку</button>
                    </div>
                    <div class="image-container" in:fly={{ x: 50, duration: 800, delay: 600 }}>
                        <img src={product} alt="Product Banner" class="floating-animation" />
                        <div class="glow-effect"></div>
                    </div>
                </div>
            {/if}
        </div>
    </header>
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
                            <div class="step-icon">{step.num}</div>
                            <div class="connector" class:last={i === 2}></div>
                            <h3>{step.title}</h3>
                            <p>{step.desc}</p>
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
                            <img src="{card2}" alt="card" />
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
                            <h2 class="counter">20+</h2>
                        </div>
                        <p>заявок ежедневно</p>
                    </div>
                    <div class="stat">
                        <div class="stat-circle">
                            <h2 class="counter">1024</h2>
                        </div>
                        <p>решенных проблем</p>
                    </div>
                    <div class="stat">
                        <div class="stat-circle">
                            <h2 class="counter">99%</h2>
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
                    <form on:submit|preventDefault={ fetchTicket } class="form_container" in:fly={{ x: 50, duration: 800 }}>
                        <h2>Наш отдел спешит на помощь!</h2>
                        <p>Оставьте заявку и мы сделаем всё возможное, чтобы решить Вашу проблему</p>
                        
                        <div class="form-field">
                            <input type="text" id="Title" name="Title" placeholder=" " required bind:value={ Title }>
                            <label for="Title">Заголовок заявки</label>
                        </div>
                        
                        <div class="form-field">
                            <textarea id="Description" name="Description" placeholder=" " required bind:value={ Description }></textarea>
                            <label for="Description">Описание проблемы</label>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-field">
                                <input type="text" id="Name" name="Name" placeholder=" " required bind:value={ Name }>
                                <label for="Name">ФИО</label>
                            </div>
                            
                            <div class="form-field">
                                <input type="text" id="Contact" name="Contact" placeholder=" " required bind:value={ Contact }>
                                <label for="Contact">Контактный телефон</label>
                            </div>
                        </div>
                        
                        <button class="more_options" on:click|preventDefault={ swapMoreOptions }>
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
                                <input type="file" id="file" multiple accept=".jpg, .jpeg, .png, .pdf" on:change={ handleFileChange } />
                                <label for="file">
                                    <span class="file-icon">📎</span>
                                    Прикрепить файлы ({ File.length }/5)
                                </label>

                                {#if fileName.length > 0}
                                    <div class="file-list">
                                        {#each fileName as name, i}
                                            <div class="file-item">
                                                <button class="file-name" on:click={ () => removeFile(i) }>{ name }</button>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>
                        
                        <button class="promo submit-btn" type="submit">
                            Оставить заявку
                            <span class="btn-arrow">→</span>
                        </button>
                    </form>
                </div>
            {/if}
        </div>
    </main>
    <Footer />
</div>

<style>
    /* ------------ */
    /*     MAIN     */
    /* ------------ */

    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 100vh;
        margin: 0 auto;
        overflow-x: hidden;
    }

    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 0 20px;
        color: var(--blue);
        width: 100%;
    }
    
    .section-title {
        font-size: 2.5rem;
        margin-bottom: 2.5rem;
        text-align: center;
        background-image: var(--blue-gradient);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
    }

    /* ------------ */
    /*    HEADER    */
    /* ------------ */

    header {
        width: 100%;
        background-color: var(--light-blue);
        background-image: radial-gradient(circle at top right, rgba(255,255,255,0.8) 0%, var(--light-blue) 70%);
        padding: var(--padding-top) 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        min-height: 90vh;
        position: relative;
    }

    .header_content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 70vw;
        height: 100%;
        padding: 0 15vw;
        position: relative;
        z-index: 2;
    }

    .title {
        width: 100%;
        height: 100%;
        margin-bottom: 2rem;
    }

    .title h1 {
        font-size: 4rem;
        font-weight: 700;
        color: var(--dark);
        text-align: left;
        line-height: 1.2;
        margin-top: 8rem;
    }
    
    .gradient-text {
        background-image: var(--blue-gradient);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
    }

    .description {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        width: 40%;
        height: 100%;
        color: var(--text);
        font-weight: 300;
        line-height: 1.7;
        position: relative;
        z-index: 2;
    }

    .description p {
        width: 90%;
        font-size: 1.15rem;
        margin-bottom: 2rem;
    }

    .banner {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        position: relative;
    }
    
    .image-container {
        position: relative;
        width: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .banner img {
        top: 100px;
        position: relative;
        width: 100%;
        height: auto;
        max-width: 800px;
        border-radius: 8px;
        filter: hue-rotate(180deg) invert(1);
    }
    
    .glow-effect {
        position: absolute;
        width: 80%;
        height: 80%;
        background: rgba(7, 92, 239, 0.1);
        border-radius: 50%;
        filter: blur(50px);
        z-index: 1;
    }

    /* ------------ */
    /*  ANIMATIONS  */
    /* ------------ */
    
    .floating-animation {
        animation: float 6s ease-in-out infinite;
    }
    
    .floating-animation-slow {
        animation: float 8s ease-in-out infinite;
    }
    
    .pulse-animation {
        animation: pulse 2s infinite;
    }
    
    @keyframes float {
        0% {
            transform: translateY(0px);
        }
        50% {
            transform: translateY(-15px);
        }
        100% {
            transform: translateY(0px);
        }
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(7, 92, 239, 0.4);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(7, 92, 239, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(7, 92, 239, 0);
        }
    }

    button {
        text-decoration: none;
        color: var(--white);
        font-weight: 500;
        font-size: 1.1rem;
        border: none;
        background: var(--blue);
        padding: 14px 40px;
        border-radius: 30px;
        margin-top: 1rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(7, 92, 239, 0.25);
        position: relative;
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    button:hover {
        background: var(--dark);
        color: var(--white);
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(7, 92, 239, 0.3);
    }
    
    button:active {
        transform: translateY(0);
        box-shadow: 0 2px 10px rgba(7, 92, 239, 0.2);
    }

    /* ------------ */
    /*    STEPS     */
    /* ------------ */

    .how-it-works {
        width: 70vw;
        margin: 150px 0;
        text-align: center;
    }
    
    .how-it-works h2 {
        font-size: 2.5rem;
        margin-bottom: 4rem;
        color: var(--dark);
        position: relative;
        display: inline-block;
    }
    
    .how-it-works h2::after {
        content: "";
        position: absolute;
        bottom: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 80px;
        height: 4px;
        background: var(--blue);
        border-radius: 2px;
    }
    
    .steps {
        display: flex;
        justify-content: center;
        position: relative;
    }
    
    .step {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 20px;
        position: relative;
        max-width: 350px;
    }
    
    .step-icon {
        width: 70px;
        height: 70px;
        background: var(--blue);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        font-weight: 600;
        margin-bottom: 20px;
        position: relative;
        z-index: 2;
        box-shadow: 0 6px 20px rgba(7, 92, 239, 0.3);
    }
    
    .connector {
        position: absolute;
        top: 35px;
        right: -50%;
        width: 100%;
        height: 3px;
        background: var(--blue);
        z-index: 1;
    }
    
    .connector.last {
        display: none;
    }
    
    .step h3 {
        font-size: 1.4rem;
        margin-bottom: 10px;
        color: var(--dark);
    }
    
    .step p {
        color: var(--text);
        line-height: 1.5;
        font-weight: 300;
    }

    /* ------------ */
    /*    CARDS     */
    /* ------------ */

    .cards {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 80px 0;
        background-color: #f7f9fc;
    }
    
    .cards_row {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        width: 70vw;
        margin-bottom: 2rem;
        gap: 30px;
    }
    
    .secondary-row {
        margin-top: 20px;
    }

    .card {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        flex: 1;
        padding: 2rem;
        background-color: #fff;
        color: var(--text);
        overflow: hidden;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
    }
    
    .hover-effect:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(7, 92, 239, 0.1);
    }
    
    .card:hover .card_title {
        color: var(--blue);
    }

    .cards_row:first-child .card {
        min-height: 350px;
    }

    .card_title {
        font-size: 1.3rem;
        font-weight: 600;
        margin-top: 1rem;
        position: relative;
        z-index: 2;
        color: var(--dark);
        transition: color 0.3s ease;
    }

    .card-image-container {
        position: relative;
        height: 200px;
        overflow: hidden;
        margin: 15px 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .card img {
        width: 80%;
        height: auto;
        object-fit: contain;
        transition: transform 0.5s ease;
    }
    
    .card:hover img {
        transform: scale(1.05);
    }

    .card p {
        line-height: 1.6;
        font-weight: 300;
        margin-top: auto;
    }

    .icon {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        background: rgba(7, 92, 239, 0.1);
        border-radius: 30px;
        color: var(--blue);
        width: fit-content;
        font-weight: 600;
        font-size: .9rem;
        z-index: 2;
    }

    .icon svg {
        fill: var(--blue);
        width: 16px;
        height: 16px;
        margin-right: 8px;
    }
    
    .icon-text {
        margin-left: 4px;
    }

    /* ------------ */
    /*    STATS     */
    /* ------------ */

    .stats {
        width: 100%;
        padding: 180px 0 100px 0;
        background-color: var(--white);
        position: relative;
        overflow: hidden;
    }
    
    .stats-container {
        display: flex;
        justify-content: space-around;
        width: 70vw;
        margin: 0 auto;
        position: relative;
        z-index: 2;
    }

    .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: var(--text);
    }
    
    .stat-circle {
        width: 180px;
        height: 180px;
        border-radius: 50%;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        box-shadow: 0 5px 30px rgba(7, 92, 239, 0.15);
        position: relative;
    }
    
    .stat-circle::before {
        content: '';
        position: absolute;
        width: 90%;
        height: 90%;
        border-radius: 50%;
        border: 2px dashed rgba(7, 92, 239, 0.3);
        animation: spin 30s linear infinite;
    }
    
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .counter {
        font-size: 3rem;
        font-weight: 800;
        background-image: var(--blue-gradient);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        margin: 0;
    }

    .stat p {
        font-size: 1.2rem;
        font-weight: 500;
        margin-top: 5px;
    }

    /* ------------ */
    /*     FORM     */
    /* ------------ */

    .form {
        position: relative;
        width: 100%;
        background-color: var(--light-blue);
        background-image: linear-gradient(135deg, var(--light-blue) 0%, rgba(255,255,255,0.8) 100%);
        padding: 80px 0;
        margin-top: 80px;
    }
    
    .form-content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        width: 80%;
        max-width: 1400px;
        margin: 0 auto;
        gap: 40px;
    }

    .img_container {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-start;
        position: relative;
    }

    .img_container img {
        opacity: 0;
    }

    .support_img {
        position: absolute;
        bottom: 0;
        left: 0;
        min-width: 500px;
        max-width: 40%;
        height: auto;
    }

    .form_container {
        display: flex;
        flex-direction: column;
        padding: 40px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }

    .form_container h2 {
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        color: var(--dark);
    }
    
    .form_container p {
        color: var(--text);
        margin-bottom: 2rem;
        font-weight: 300;
        line-height: 1.6;
    }
    
    .form-field {
        position: relative;
        margin-bottom: 20px;
        width: 100%;
    }
    
    .form-row {
        display: flex;
        gap: 20px;
        width: 100%;
    }
    
    .form-field input,
    .form-field textarea {
        width: calc(99% - 30px);
        padding: 15px;
        border: 1px solid #e0e0e0;
        border-radius: 5px;
        font-size: 1rem;
        background: rgba(255, 255, 255, 0.8);
        color: var(--text);
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }
    
    .form-field input:focus,
    .form-field textarea:focus {
        border-color: var(--blue);
        box-shadow: 0 0 0 2px rgba(7, 92, 239, 0.1);
        outline: none;
    }
    
    .form-field label {
        position: absolute;
        top: 15px;
        left: 15px;
        color: #999;
        pointer-events: none;
        transition: all 0.3s ease;
        background: transparent;
    }
    
    .form-field input:focus ~ label,
    .form-field textarea:focus ~ label,
    .form-field input:not(:placeholder-shown) ~ label,
    .form-field textarea:not(:placeholder-shown) ~ label {
        top: -10px;
        left: 10px;
        font-size: 0.8rem;
        padding: 0 5px;
        background: white;
        color: var(--blue);
    }
    
    .date-label {
        top: -10px !important;
        left: 10px !important;
        font-size: 0.8rem !important;
        padding: 0 5px !important;
        background: white !important;
        color: var(--blue) !important;
    }

    .more_options {
        background-color: transparent;
        color: var(--text);
        border: none;
        padding: 10px 0;
        margin: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 5px;
        box-shadow: none;
        font-weight: normal;
        width: fit-content;
    }
    
    .more_options:hover {
        color: var(--blue);
        background-color: transparent;
        transform: none;
        box-shadow: none;
    }

    .arrow {
        display: inline-block;
        transition: transform 0.3s ease;
        font-size: 0.8rem;
    }
    
    .arrow_up {
        transform: rotate(180deg);
    }
    
    .more {
        display: flex;
        flex-direction: column;
        width: 100%;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        max-height: 0;
        opacity: 0;
        transform: translateY(-10px);
    }
    
    .more_visible {
        max-height: 400px;
        opacity: 1;
        margin-top: 15px;
        margin-bottom: 15px;
        padding-top: 15px;
        transform: translateY(0);
    }
    
    .file-upload {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
    }

    .file-list {
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
    }

    .file-name {
        display: inline-block;
        padding: 6px 10px;
        background-color: rgba(7, 92, 239, 0.05);
        border-radius: 5px;
        font-size: 0.9rem;
        color: var(--text);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        position: relative;
        margin-top: 0px;
        box-shadow: none;
    }

    .file-name:hover {
        background-color: var(--light-gray);
        color: var(--blue);
        box-shadow: none;
    }

    .file-name::before {
        content: '✓';
        display: inline-block;
        margin-right: 5px;
        color: var(--blue);
        font-weight: 600;
    }
    
    .file-upload input {
        display: none;
    }
    
    .file-upload label {
        display: inline-flex;
        align-items: center;
        padding: 10px 15px;
        background: rgba(7, 92, 239, 0.1);
        color: var(--blue);
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .file-upload label:hover {
        background: rgba(7, 92, 239, 0.2);
    }
    
    .file-icon {
        margin-right: 8px;
        font-size: 1.2rem;
    }
    
    .submit-btn {
        margin-top: 20px;
        width: 100%;
    }
    
    .btn-arrow {
        margin-left: 10px;
        transition: transform 0.3s ease;
    }
    
    .submit-btn:hover .btn-arrow {
        transform: translateX(5px);
    }

    /* ------------ */
    /*    MEDIA     */
    /* ------------ */

    @media (max-width: 1450px) {
        .header_content,
        .cards_row,
        .stats-container {
            width: 85vw;
        }

        .form-content {
            grid-template-columns: 30% 1fr;
        }
    }

    @media (max-width: 1280px) {
        .header_content {
            width: 90vw;
            padding: 0 5vw;
        }
        
        .banner img {
            max-width: 500px;
        }
        
        .title h1 {
            font-size: 3.5rem;
        }
    }
    
    @media (max-width: 1180px) {
        .form-content {
            grid-template-columns: 1fr;
            width: 90%;
        }

        .img_container, .support_img {
            display: none;
        }
    }

    @media (max-width: 1080px) {
        header {
            min-height: auto;
            padding-bottom: 4rem;
        }

        .description {
            width: 100%;
        }
        
        .image-container {
            display: none;
        }
        
        .title h1 {
            margin-top: 4rem;
            font-size: 3rem;
        }
        
        .cards_row:first-child {
            flex-direction: column;
            align-items: center;
        }
        
        .cards_row:first-child .card {
            width: 80%;
            margin-bottom: 20px;
        }
        
        .stats-container {
            flex-direction: column;
            gap: 50px;
        }
    }
    
    @media (max-width: 768px) {
        .how-it-works {
            width: 90vw;
        }
        
        .steps {
            flex-direction: column;
            gap: 40px;
            align-items: center;
        }
        
        .connector {
            display: none;
        }
        
        .secondary-row {
            display: none;
        }
        
        .form-row {
            flex-direction: column;
        }
    }
</style>