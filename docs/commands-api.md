# Operations API

Queryn extensions declare serializable operations in Extension Manifest v1 and
provide handlers separately. `definePlugin` and Commands API remain only as an
experimental 0.1 compatibility layer.

An operation declares JSON input/output schemas, accepted and produced artifact
types, risk, agent visibility, execution mode, timeout and permissions. Manual UI
and agent invocations go through the same Job Manager.

## Правила

- Operation IDs are globally unique and use the extension prefix.
- Tool performs the work; the agent only requests an operation.
- Runtime writes candidates to outbox and never edits the project directly.
- Host validates schemas, policy and output before publication.
- Operation schemas use the JSON Schema 2020-12 structural subset implemented by
  the host: local `$ref`, composition, object/array/string/number constraints,
  common formats and `additionalProperties`. External `$ref` is forbidden;
  regex patterns are length-limited and linted against backreferences,
  lookarounds and nested quantifiers so a package cannot block the runtime with
  catastrophic backtracking.
- A contributed Model Provider declares `recipient: local | cloud` and implements
  `models/complete`; the host owns recipient approval and never passes credentials
  through the project.
- A Context Provider backed by MCP declares `resourceUriTemplate`; `{artifactId}`
  is substituted by the host and resolved through `resources/read`.
