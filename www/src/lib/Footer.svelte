<!--
--- @file Footer.svelte
--- Файл для отображения нижнего колонтитула сайта
--- Монтируется в +layout.svelte
-->

<footer>
    <div class="footer_content">
        <div class="footer-main">
            <div class="footer-column">
                <h3>О системе</h3>
                <p>Репозиторий: <span><a href="https://github.com/BlackRavenoo/KFU_OIT_system">GitHub</a></span></p>
                <p>Frontend: <span><a href="https://ivanvit.ru">Ivanvit</a></span></p>
                <p>Backend: <span><a href="https://github.com/BlackRavenoo">BlackRavenoo</a></span></p>
            </div>
            <div class="footer-column">
                <h3>Контакты</h3>
                <p>Телефон: <span><a href="tel:+79869142780">+7 (986) 914-27-80</a></span></p>
                <p>Email: <span><a href="/">support@kfu.ru</a></span></p>
            </div>
            <div class="footer-column">
                <h3>Ссылки</h3>
                <ul>
                    <li><a href="/faq">Частые вопросы</a></li>
                    <li><a href="/privacy">Политика конфиденциальности</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>© 2025 КФУ. Все права защищены.</p>
            <p>Разработано с любовью к пользователям</p>
        </div>
    </div>
</footer>

<style>
    footer {
        background-color: var(--dark);
        color: var(--white);
        padding: 50px 0 20px;
        width: 100%;
    }
    
    .footer_content {
        width: 80%;
        margin: 0 auto;
        max-width: 1200px;
    }
    
    .footer-main {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 40px;
        margin-bottom: 40px;
    }
    
    .footer-column h3 {
        font-size: 1.2rem;
        margin-bottom: 20px;
        position: relative;
        display: inline-block;
    }
    
    .footer-column h3::after {
        content: "";
        position: absolute;
        bottom: -8px;
        left: 0;
        width: 30px;
        height: 2px;
        background-color: var(--blue);
    }
    
    .footer-column p {
        margin-bottom: 10px;
        opacity: 0.8;
        font-weight: 300;
        line-height: 1.6;
    }
    
    .footer-column span {
        color: var(--light-blue);
        font-weight: 500;
    }
    
    .footer-column ul {
        list-style: none;
        padding: 0;
    }
    
    .footer-column ul li {
        margin-bottom: 8px;
    }
    
    .footer-column a {
        color: var(--white);
        opacity: 0.8;
        text-decoration: none;
        transition: opacity 0.3s ease;
    }
    
    .footer-column a:hover {
        opacity: 1;
        color: var(--light-blue);
    }
    
    .footer-bottom {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 20px;
        text-align: center;
        font-size: 0.9rem;
        opacity: 0.7;
    }

    @media (max-width: 1180px) {   
        .footer-main {
            grid-template-columns: 1fr 1fr;
        }
    }

    @media (max-width: 768px) {
        .footer-main {
            grid-template-columns: 1fr;
        }
    }
</style>