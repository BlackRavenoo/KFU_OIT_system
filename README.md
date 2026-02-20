# Service Desk ЕИ КФУ
Frontend v0.1.19 | Backend v0.3.0 | API v1

[![Build and Test](https://github.com/BlackRavenoo/KFU_OIT_system/actions/workflows/rust_test.yaml/badge.svg)](https://github.com/BlackRavenoo/KFU_OIT_system/actions/workflows/build_and_test.yaml) 
[![Test frontend](https://github.com/BlackRavenoo/KFU_OIT_system/actions/workflows/test.yaml/badge.svg)](https://github.com/BlackRavenoo/KFU_OIT_system/actions/workflows/test.yaml)

![Интерфейс системы заявок](/www/src/assets/product.webp)


О платформе
-----------------
Данный репозиторий представляет собой внутреннюю платформу для управления заявками и сопровождения ИТ‑сервисов Елабужского института Казанского (Приволжского) Федерального Университета. Система предоставляет интерфейсы для создания, назначения и отслеживания заявок, а также административные инструменты для управления справочными сущностями (здания, отделы и т.д.), сбора и систематизации внутренней статистики, управления пользователями.

Предусмотрена возможность использовать веб-версию системы, установить её в качестве приложения (технология PWA), а также использовать некоторые функции платформы через Bot API (собственные боты для Telegram, WhatsApp и тд.).

Структура репозитория
---------------------
```
KFU_OIT_SYSTEM/
├── infra/              # Инфраструктура (Docker)
├── ticketing-system/   # Backend (Rust)
├── www/                # Frontend (SvelteKit)
├── .env
└── docker-compose.yaml
```

Быстрый старт
-------------
In progress...

Вклад и кодстайл
----------------
Перед отправкой PR выполните все локальные тесты. Обязательно покройте тестами все новые функции, которые были внесены в коммит. Описывайте изменения в описании PR и связывайте с соответствующими [issue](https://github.com/BlackRavenoo/KFU_OIT_system/issues).

Дополнительно
------------
Просмотрите README внутри папок [`www`](/www/) и [`ticketing-system`](/ticketing-system/) для детальных инструкций по разработке, запуску и деплою frontend и backend части.

Лицензия и контакты
-------------------
Проект лизензирован по публичной лицензии APL v2, с деталями которой можно подробнее ознакомиться в соотвествующем [файле](/LICENSE).
