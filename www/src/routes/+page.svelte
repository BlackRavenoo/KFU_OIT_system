<script lang="ts">
    import '../assets/app.css';
    import product from '../assets/product.webp';
    import Nav from '$lib/Nav.svelte'
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
                    <p>Система заявок ЕИ КФУ - не просто удобный инструмент. Это система обслуживания, созданная с заботой о каждом сотруднике, призванная сделать решение проблем быстрее и проще для всех.</p> 
                    <button class="promo">Оставить заявку</button>
                </div>
                <img src={product} alt="Product Banner" />
            </div>
        </div>
    </header>
    <main>
        <p>Lorem Ipsum Dolor Sit Dolores. Lorem Ipsum Dolor Sit Dolores. Lorem Ipsum Dolor Sit Dolores.</p>
    </main>
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
        background-color: var(--blue);
        padding: 12px 50px;
        border-radius: 0;
        margin-top: 1rem;
        transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    button:hover {
        background-color: var(--dark);
        color: var(--white);
    }

    @media (max-width: 1450px) {
        .header_content {
            width: 85vw;
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
    }
</style>
