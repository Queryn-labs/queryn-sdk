# osnova-plugin-sdk

Extension SDK и Developer Kit для Osnova Reborn.
Каноническая [страница документации](https://github.com/Queryn-labs/osnova-docs) содержит правила расширений и их место в архитектуре.

## Статус

Extension Manifest v1, operation handlers, artifact candidates, context
providers, connectors, model providers, package validation, testkit и headless
CLI. Extension host реализован в `osnova-runtime`.

## Stack

- TypeScript
- Node.js CLI
- pnpm 10.5.2

## Команды

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

## Границы

SDK определяет публичную поверхность автора расширений:

- `definePlugin` и `defineExtension`
- `defineTool` / `defineOperation`
- `defineArtifactType` / `defineContextProvider`
- `defineConnector` / `defineModelProvider`
- проверка manifest, testkit и portable package format

`definePlugin` сохранён как compatibility API для экспериментального формата
0.1. Новые расширения используют `defineExtension`.

`templates/basic-plugin` содержит минимальный пакет расширения.

SDK должен оставаться явным и стабильным. Он определяет API и формат упаковки,
но не запускает и не размещает расширения. Их host-среда, lifecycle, process/OCI
изоляция, permissions enforcement и RPC находятся в `osnova-runtime`.
SDK не добавляет host APIs без понятной permission model и пути enforcement на стороне runtime.
`osnova-desktop` подключает runtime через свой IPC bridge.

## Связанные репозитории

- `osnova-runtime` загружает расширения, исполняет их runtime и проверяет
  permissions.
- `osnova-desktop` предоставляет пользовательский интерфейс и IPC-интеграцию
  с runtime.
- `osnova-core` предоставляет общие типы проекта.
- `osnova-plugins` содержит каталог плагинов.
- `osnova-spec` определяет Extension Manifest v1 и связанные схемы.
- `osnova-docs` содержит нормативные правила расширений и доверия.

## Лицензия

MIT.
