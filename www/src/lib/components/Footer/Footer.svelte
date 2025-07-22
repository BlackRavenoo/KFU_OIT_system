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

<style scoped>
    @import './Footer.css';
</style>