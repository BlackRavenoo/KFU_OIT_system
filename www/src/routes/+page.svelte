<script lang="ts">
    import '../assets/app.css';
    import product from '../assets/product.webp';
    import support from '../assets/support.png';
    import card1 from '../assets/card_filler.svg';
    import card2 from '../assets/card_filler.svg';
    import Nav from '$lib/Nav.svelte'

    let moreOptionsVisible: boolean = false;

    let Title: string = '';
    let Description: string = '';
    let Name: string = '';
    let Contact: string = '';
    let DateVal: string = '';
    let File: File | null = null;

    function swapMoreOptions() {
        moreOptionsVisible = !moreOptionsVisible;
    }

    function fetchTicket() {
        console.log('Заявка отправлена:', { Title, Description, Name, Contact, DateVal, File });
    }
</script>

<div class="container">
    <slot />
    <header>
        <Nav />
        <div class="header_content">
            <div class="title">
                <h1>Удобный инструмент <br /> 
                    для решения Ваших проблем</h1>
            </div>
            <div class="banner">
                <div class="description">
                    <p>Система заявок ЕИ КФУ - не просто современная платформа. Это система обслуживания, созданная с заботой о каждом сотруднике, призванная сделать решение проблем быстрее и проще для всех.</p> 
                    <button class="promo">Оставить заявку</button>
                </div>
                <img src={product} alt="Product Banner" />
            </div>
        </div>
    </header>
    <main>
        <div class="cards">
            <div class="cards_row">
                <div class="card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 184.4c-17-15.2-39.4-24.4-64-24.4L64 256c-24.6 0-47 9.2-64 24.4L0 96zM64 288l384 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64l0-64c0-35.3 28.7-64 64-64zM320 416a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm128-32a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg> 
                        Систематизированно
                    </span>
                    <h3 class="card_title">Все задачи в одном месте</h3>
                    <img src="{card1}" alt="card" />
                    <p>Ни одна заявка не останется незамеченной</p>
                </div>
                <div class="card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M88 0C74.7 0 64 10.7 64 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C120.5 112.3 128 119.9 128 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C119.5 47.7 112 40.1 112 24c0-13.3-10.7-24-24-24zM32 192c-17.7 0-32 14.3-32 32L0 416c0 53 43 96 96 96l192 0c53 0 96-43 96-96l16 0c61.9 0 112-50.1 112-112s-50.1-112-112-112l-48 0L32 192zm352 64l16 0c26.5 0 48 21.5 48 48s-21.5 48-48 48l-16 0 0-96zM224 24c0-13.3-10.7-24-24-24s-24 10.7-24 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C232.5 112.3 240 119.9 240 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C231.5 47.7 224 40.1 224 24z"/></svg>
                        Удобно
                    </span>
                    <h3 class="card_title">Простой интерфейс</h3>
                    <img src="{card2}" alt="card" />
                    <p>Интуитивно понятный интерфейс для быстрого доступа к заявкам</p>
                </div>
            </div>
            <div class="cards_row">
                <div class="card blue">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M304 240l0-223.4c0-9 7-16.6 16-16.6C443.7 0 544 100.3 544 224c0 9-7.6 16-16.6 16L304 240zM32 272C32 150.7 122.1 50.3 239 34.3c9.2-1.3 17 6.1 17 15.4L256 288 412.5 444.5c6.7 6.7 6.2 17.7-1.5 23.1C371.8 495.6 323.8 512 272 512C139.5 512 32 404.6 32 272zm526.4 16c9.3 0 16.6 7.8 15.4 17c-7.7 55.9-34.6 105.6-73.9 142.3c-6 5.6-15.4 5.2-21.2-.7L320 288l238.4 0z"/></svg>
                    </span>
                    <h3 class="card_title">Статистика</h3>
                    <p>Отслеживайте эффективность работы и время решения заявок</p>
                </div>
                <div class="card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M152.1 38.2c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 113C-2.3 103.6-2.3 88.4 7 79s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zm0 160c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 273c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zM224 96c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zm0 160c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zM160 416c0-17.7 14.3-32 32-32l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32zM48 368a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/></svg>
                    </span>
                    <h3 class="card_title">Удобная форма</h3>
                    <p>Легко оставляйте заявки на сайте, а также через Telegram и WhatsApp</p>
                </div>
                <div class="card">
                    <span class="icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M16 64C16 28.7 44.7 0 80 0L304 0c35.3 0 64 28.7 64 64l0 384c0 35.3-28.7 64-64 64L80 512c-35.3 0-64-28.7-64-64L16 64zM144 448c0 8.8 7.2 16 16 16l64 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-64 0c-8.8 0-16 7.2-16 16zM304 64L80 64l0 320 224 0 0-320z"/></svg>
                    </span>
                    <h3 class="card_title">Мобильность</h3>
                    <p>Доступ к заявкам с любого устройства, где есть интернет</p>
                </div>
            </div>
        </div>
        <div class="stats">
            <div class="stat">
                <h2>До 20</h2>
                <p>выполненных заявок ежедневно</p>
            </div>
            <div class="stat">
                <h2>1000</h2>
                <p>решенных проблем</p>
            </div>
            <div class="stat">
                <h2>99%</h2>
                <p>проблем решается</p>
            </div>
        </div>
        <div class="form">
            <div class="img_container">
                <img src="{ support }" alt="support">
            </div>
            <div class="form_container">
                <h2>Наш отдел спешит на помощь!</h2>
                <p>Оставьте заявку и мы сделаем всё возможное, чтобы решить Вашу проблему</p>
                <input type="text" id="Title" name="Title" placeholder="Заголовок заявки" required bind:value={ Title }>
                <textarea id="Description" name="Description" placeholder="Описание проблемы" required bind:value={ Description }></textarea>
                <input type="text" id="Name" name="Name" placeholder="ФИО" required bind:value={ Name }>
                <input type="text" id="Contact" name="Contact" placeholder="+7 (123) 456-78-90" required bind:value={ Contact }>
                <input type="button" value="Больше опций ▼" class="more_options" on:click={ swapMoreOptions }>
                <div class="more { moreOptionsVisible && 'more_visible' }">
                    <input
                        type="datetime-local"
                        id="Date" name="Date"
                        min="2025-06-07T00:00"
                        max="2045-06-14T00:00" 
                        bind:value={ DateVal } />
                    <input type="file" alt="" bind:value={ File } accept=".jpg, .jpeg, .png, .pdf" />
                </div>
                <button class="promo" on:click={ fetchTicket() }>Оставить заявку</button>
            </div>
        </div>
    </main>
    <footer>
        <div class="footer_content">
            <p>© 2025 КФУ. Все права защищены.</p>
            <p>Разработано с любовью к пользователям.</p>
            <p>По всем вопросам обращаться: <span>+7 (123) 456-78-90</span></p>
        </div>
    </footer>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100vw;
        min-height: 100vh;
        margin: 0 auto;
    }

    main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 0 20px;
        color: var(--blue);
    }

    header {
        width: 100%;
        background-color: var(--light-blue);
        padding: var(--padding-top) 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        min-height: 80vh;
    }

    .header_content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 70vw;
        height: 100%;
        padding: 0 15vw;
    }

    .title {
        width: 100%;
        height: 100%;
    }

    .title h1 {
        font-size: 4rem;
        font-weight: 700;
        color: var(--dark);
        text-align: left;
        transform: translate(0, 5rem);
        line-height: 5rem;
    }

    .description {
        display: flex;
        flex-direction: column;
        align-items: baseline;
        align-self: flex-start;
        justify-content: center;
        width: 30vw;
        height: 100%;
        color: var(--text);
        font-weight: 200;
    }

    .description p {
        width: 80%;
        font-size: 1.15rem;
    }

    .banner {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        transform: translate(0, 8rem);
    }

    .banner img {
        width: 100%;
        height: auto;
        max-width: 800px;
        border-radius: 8px;
        filter: hue-rotate(180deg) invert(1);
    }

    button {
        text-decoration: none;
        color: var(--white);
        font-weight: 400;
        font-size: 1.1rem;
        transition: color 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        border: none;
        background: var(--blue);
        padding: 12px 50px;
        border-radius: 0;
        margin-top: 1rem;
        transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    button:hover {
        background: var(--dark);
        color: var(--white);
    }

    .cards {
        display: flex;
        flex-direction: column;
        width: 100vw;
        margin-top: 350px;
    }
    
    .cards_row {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 70vw;
        padding: 0 15vw;
        margin-bottom: 2rem;
        gap: 40px;
    }

    .card {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        flex: 1;
        padding: 2rem 3rem;
        background-color: #fff;
        color: var(--text);
        overflow: hidden;
    }

    .cards_row:first-child .card {
        min-height: 350px;
        padding-bottom: 0;
    }

    .card_title {
        font-size: larger;
        margin-top: 1rem;
        position: relative;
        z-index: 2;
    }

    .card img {
        height: 450px;
        width: 350px;
        position: absolute;
        transform: translate(-50%, -15%);
        top: 50%;
        left: 50%;
        z-index: 1;
        mask-image: linear-gradient(to bottom, 
            rgba(0,0,0,1) 60%, 
            rgba(0,0,0,0) 95%);
        -webkit-mask-image: linear-gradient(to bottom, 
            rgba(0,0,0,1) 60%, 
            rgba(0,0,0,0) 95%);
    }

    .card p {
        transform: translate(0, -20px);
    }

    .cards_row:first-child .card p {
        margin-top: auto;
        position: relative;
        z-index: 3;
        background: linear-gradient(to bottom,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.8) 20%,
            rgba(255,255,255,1) 50%);
        padding-top: 30px;
        margin-bottom: 0;
        padding-bottom: calc(2rem + 10px);
        transform: translate(0, 0);
        margin-bottom: 0;
    }

    .icon {
        display: flex;
        align-items: center;
        color: var(--text);
        width: fit-content;
        font-weight: 600;
        font-size: .9rem;
        z-index: 2;
    }

    .icon svg {
        fill: var(--blue);
        width: 20px;
        height: 20px;
        margin-right: 8px;
        transform: translate(0, -.1rem);
    }

    .blue {
        background-color: var(--light-blue);
    }

    .blue .icon svg {
        fill: #fff;
    }

    .stats {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        width: 70vw;
        padding: 0 15vw;
        margin-top: 250px;
    }

    .stat {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        color: var(--text);
    }

    .stat h2 {
        font-size: 5rem;
        font-weight: 800;
        background-image: var(--blue-gradient);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.5rem;
    }

    .stat p {
        font-size: 1.4rem;
        font-weight: 500;
        transform: translate(0, -20px);
    }

    .form {
        display: grid;
        grid-template-columns: max(500px, 30vw) 1fr;
        width: 100vw;
        background-color: var(--light-blue);
        margin-top: 350px;
    }

    .img_container {
        padding: 0;
        display: flex;
        justify-content: end;
        flex-direction: column;
    }

    .img_container img {
        min-width: 500px;
        width: 100%;
        height: auto;
    }

    .form_container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 2rem;
        color: var(--text);
    }

    .form_container h2 {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 0;
    }

    input, textarea {
        width: 300px;
        padding: 10px;
        margin: 10px 0;
        border: 1px solid var(--white);
        border-radius: 4px;
        font-size: 1rem;
        background-color: var(--white);
        color: var(--text);
    }

    textarea {
        height: 100px;
        resize: none;
    }

    input:focus, textarea:focus {
        border-color: var(--dark);
        outline: none;
    }

    input[type="file"] {
        background-color: transparent;
        border-color: transparent;
        width: fit-content;
    }

    input[type="file"]::file-selector-button {
        background-color: var(--blue);
        color: var(--white);
        padding: 10px 20px;
        border: none;
        cursor: pointer;
        margin-right: 20px;
        filter: saturate(.7) brightness(1.2);
        transition: background-color 0.2s ease, color 0.2s ease;
    }

    input[type="file"]::file-selector-button:hover {
        background-color: var(--dark);
    }

    input[type="file"]:focus {
        border-color: transparent;
        outline: none;
    }

    .more {
        transition: max-height 0.5s ease-in-out, opacity 0.4s ease;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        overflow: hidden;
        max-height: 0;
        opacity: 0;
        margin: 0;
        padding: 0;
    }

    .more_visible {
        max-height: 200px;
        opacity: 1;
        margin-top: 15px;
        margin-bottom: 15px;
    }

    .more_options {
        background-color: transparent;
        border: none;
        margin: 0;
        cursor: pointer;
    }

    .more_options:hover {
        color: var(--dark);
    }

    @media (max-width: 1450px) {
        .header_content {
            width: 85vw;
        }

        .cards_row, .stats {
            width: 90vw;
            padding: 0 5vw;
        }
    }

    @media (max-width: 1280px) {
        .header_content {
            width: 100vw;
            padding: 0 8vw;
        }
        
        .banner img{
            width: 80%;
        }
    }

    @media (max-width: 1080px) {
        header {
            min-height: auto;
            padding-bottom: 4rem;
        }

        .header_content {
            width: 80vw;
            padding: 0 10vw;
        }

        .banner {
            justify-content: initial;
            transform: translate(0, 0);
        }
        
        .banner img{
            display: none;
        }

        .title h1 {
            font-size: 2.5rem;
            line-height: 3rem;
            transform: translate(0, 0);
        }

        .description {
            width: 100%;
        }

        .cards {
            margin-top: 150px;
        }

        .cards_row:first-child, .stats {
            flex-direction: column;
            align-items: center;
        }

        .cards_row:first-child .card {
            width: 500px;
            max-width: 90vw;
        }

        .cards_row:nth-child(2) {
            display: none;
        }
    }
</style>
