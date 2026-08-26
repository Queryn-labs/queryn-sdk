# queryn-sdk

Extension SDK и Developer Kit для Queryn.
Каноническая [страница документации](https://github.com/Queryn-labs/queryn-docs) содержит правила расширений и их место в архитектуре.

## Статус

Extension Manifest v1, operation handlers, artifact candidates, context
providers, connectors, model providers, package validation, testkit и headless
CLI. Extension host реализован в `queryn-runtime`.

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
изоляция, permissions enforcement и RPC находятся в `queryn-runtime`.
SDK не добавляет host APIs без понятной permission model и пути enforcement на стороне runtime.
`queryn-desktop` подключает runtime через свой IPC bridge.

## Связанные репозитории

- `queryn-runtime` загружает расширения, исполняет их runtime и проверяет
  permissions.
- `queryn-desktop` предоставляет пользовательский интерфейс и IPC-интеграцию
  с runtime.
- `queryn-core` предоставляет общие типы проекта.
- `queryn-extensions` содержит каталог расширений.
- `queryn-spec` определяет Extension Manifest v1 и связанные схемы.
- `queryn-docs` содержит нормативные правила расширений и доверия.

## Лицензия

MIT.
