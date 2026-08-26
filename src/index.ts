/**
 * Public extension SDK contracts and validation helpers.
 * Manifest types mirror the generated queryn-spec contract.
 */
import type {
  ExtensionManifest,
  Permission as ExtensionPermission,
  OperationRisk,
  RuntimeKind,
  RuntimeLifecycle,
  Runtime as RuntimeContribution,
  Resources as ResourceRequirements,
  ModelDependency,
  ExtensionContributions,
  Theme as ThemeContribution,
  Tool as ToolContribution,
  Operation as OperationDefinition,
  ArtifactType as ArtifactTypeContribution,
  ContextProvider as ContextProviderContribution,
  Connector as ConnectorContribution,
  ModelProvider as ModelProviderContribution,
  View as ViewContribution
} from "./generated/extension-manifest.generated.js";

/** Re-exports the generated Extension Manifest v1 contract types. */
export type {
  ExtensionManifest,
  ExtensionPermission,
  OperationRisk,
  RuntimeKind,
  RuntimeLifecycle,
  RuntimeContribution,
  ResourceRequirements,
  ModelDependency,
  ExtensionContributions,
  ThemeContribution,
  ToolContribution,
  OperationDefinition,
  ArtifactTypeContribution,
  ContextProviderContribution,
  ConnectorContribution,
  ModelProviderContribution,
  ViewContribution
};
// Context provider API types that are not part of the manifest contract.
/** Controls the detail level requested from a context provider. */
export type ContextLevel = "compact" | "expanded";

/** Selects how an artifact context is produced. */
export type ContextMode = "none" | "automatic" | "declarative" | "custom";

/** Describes an artifact supplied to an operation or context provider. */
export interface ArtifactInput {
  artifactId: string;
  type: string;
  title?: string;
  payloads: Array<{ path: string; mediaType: string; role?: string }>;
}

/** Describes an artifact payload that an operation proposes for publication. */
export interface ArtifactCandidate {
  id?: string;
  type: string;
  title?: string;
  payloads: Array<{ path: string; mediaType?: string; role?: string }>;
  context?: { mode: ContextMode; providerId?: string; fields?: string[]; template?: string };
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Contains structured output and artifact candidates returned by an operation. */
export interface OperationResult {
  structured?: Record<string, unknown>;
  artifacts?: ArtifactCandidate[];
  message?: string;
}

/** Provides the project-scoped inputs and cancellation hooks for an operation. */
export interface OperationContext {
  jobId: string;
  projectId: string;
  sessionId?: string;
  input: Record<string, unknown>;
  artifacts: ArtifactInput[];
  outboxPath: string;
  signal: AbortSignal;
  reportProgress(progress: number, message?: string): void;
}

/** Handles one operation invocation synchronously or asynchronously. */
export type OperationHandler = (context: OperationContext) => Promise<OperationResult> | OperationResult;

/** Carries provider-produced context together with source and recipient constraints. */
export interface ContextEnvelope {
  level: ContextLevel;
  text?: string;
  structured?: Record<string, unknown>;
  sources: Array<{ artifactId: string; payloadPath?: string }>;
  sensitivity: "public" | "project" | "sensitive";
  allowedRecipients: Array<"local" | "cloud">;
  tokenEstimate: number;
  truncated: boolean;
  freshness?: string;
  providerVersion: string;
}

/** Supplies an artifact and token budget to a context provider. */
export interface ContextProviderInput {
  level: ContextLevel;
  artifact: ArtifactInput;
  budgetTokens: number;
  recipient: "local" | "cloud";
}

/** Builds a context envelope synchronously or asynchronously. */
export type ContextProviderHandler = (input: ContextProviderInput) => Promise<ContextEnvelope> | ContextEnvelope;

/** Defines a manifest and the handlers exposed by an extension. */
export interface QuerynExtension {
  manifest: ExtensionManifest;
  operations?: Record<string, OperationHandler>;
  contextProviders?: Record<string, ContextProviderHandler>;
}

/** Validates an extension manifest and ensures its handlers are declared. */
export function defineExtension(extension: QuerynExtension): QuerynExtension {
  const validation = validateExtensionManifest(extension.manifest);
  if (!validation.valid) {
    throw new Error(validation.issues.join("\n"));
  }

  const declaredOperations = new Set(extension.manifest.contributes.operations?.map((operation) => operation.id) ?? []);
  for (const operationId of Object.keys(extension.operations ?? {})) {
    if (!declaredOperations.has(operationId)) {
      throw new Error(`Operation handler is not declared in manifest: ${operationId}`);
    }
  }
  return extension;
}

/** Preserves the inferred type of a tool contribution. */
export function defineTool<T extends ToolContribution>(tool: T): T {
  return tool;
}

/** Preserves the inferred type of an operation contribution. */
export function defineOperation<T extends OperationDefinition>(operation: T): T {
  return operation;
}

/** Preserves the inferred type of an artifact type contribution. */
export function defineArtifactType<T extends ArtifactTypeContribution>(artifactType: T): T {
  return artifactType;
}

/** Preserves the inferred type of a context provider contribution. */
export function defineContextProvider<T extends ContextProviderContribution>(provider: T): T {
  return provider;
}

/** Preserves the inferred type of a connector contribution. */
export function defineConnector<T extends ConnectorContribution>(connector: T): T {
  return connector;
}

/** Preserves the inferred type of a model provider contribution. */
export function defineModelProvider<T extends ModelProviderContribution>(provider: T): T {
  return provider;
}

/** Reports manifest validation status and human-readable issues. */
export interface ManifestValidationResult {
  valid: boolean;
  issues: string[];
}

const knownPermissions = new Set<ExtensionPermission>([
  "project:read",
  "artifact:read",
  "artifact:create",
  "network:use",
  "models:use",
  "models:install",
  "compute:gpu",
  "native:execute",
  "external:apps",
  "secrets:read",
  "background:run"
]);

/** Validates manifest structure, permissions, references, resources, and runtime policy. */
export function validateExtensionManifest(manifest: ExtensionManifest): ManifestValidationResult {
  const issues: string[] = [];
  if (manifest.manifestVersion !== "1") issues.push("manifestVersion must be 1.");
  if (!isNamespacedId(manifest.id)) issues.push("Extension id must be namespaced.");
  if (!manifest.name.trim()) issues.push("Extension name is required.");
  if (!isSemver(manifest.version)) issues.push("Extension version must be semver.");
  if (!manifest.queryn?.minVersion || !isSemver(manifest.queryn.minVersion)) issues.push("queryn.minVersion must be semver.");
  for (const permission of manifest.permissions) {
    if (!knownPermissions.has(permission)) issues.push(`Unknown permission: ${permission}`);
  }

  const runtimeIds = new Set<string>();
  const runtimesById = new Map<string, RuntimeContribution>();
  for (const runtime of manifest.runtimes ?? []) {
    validateContributionId(runtime.id, manifest.id, "Runtime", issues);
    if (runtimeIds.has(runtime.id)) issues.push(`Duplicate runtime id: ${runtime.id}`);
    runtimeIds.add(runtime.id);
    runtimesById.set(runtime.id, runtime);
    if ((runtime.kind === "node-process" || runtime.kind === "native-process") && !runtime.entry) {
      issues.push(`Runtime ${runtime.id} requires entry.`);
    }
    if (runtime.entry && !isSafePackagePath(runtime.entry)) issues.push(`Runtime ${runtime.id} entry must be a safe package-relative path.`);
    if (runtime.kind === "oci" && !runtime.image) issues.push(`OCI runtime ${runtime.id} requires image.`);
    if (runtime.kind === "oci" && runtime.image && !/@sha256:[a-f0-9]{64}$/.test(runtime.image)) issues.push(`OCI runtime ${runtime.id} image must be pinned by a full SHA-256 digest.`);
    if (runtime.kind === "oci" && runtime.lifecycle !== "job") issues.push(`OCI runtime ${runtime.id} must use job lifecycle to preserve per-invocation mounts.`);
    if (runtime.kind === "remote" && !runtime.endpoint) issues.push(`Remote runtime ${runtime.id} requires endpoint.`);
    if (runtime.kind === "remote" && runtime.endpoint && !isSafeRemoteEndpoint(runtime.endpoint)) issues.push(`Remote runtime ${runtime.id} requires HTTPS unless it uses loopback.`);
    if (runtime.kind === "native-process" && !manifest.permissions.includes("native:execute")) issues.push(`Native runtime ${runtime.id} requires native:execute permission.`);
    if (runtime.lifecycle !== "job" && !manifest.permissions.includes("background:run")) issues.push(`Persistent runtime ${runtime.id} requires background:run permission.`);
    if ((runtime.kind === "remote" || runtime.resources?.network) && !manifest.permissions.includes("network:use")) issues.push(`Runtime ${runtime.id} requires network:use permission.`);
    if (runtime.resources?.gpu && !manifest.permissions.includes("compute:gpu")) issues.push(`Runtime ${runtime.id} requires compute:gpu permission.`);
    if (runtime.models?.length && !manifest.permissions.includes("models:use")) issues.push(`Runtime ${runtime.id} declares models but models:use is missing.`);
    for (const [name, value] of Object.entries(runtime.resources ?? {})) {
      if (name === "network" || name === "gpu") continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) issues.push(`Runtime ${runtime.id} resource ${name} must be positive.`);
    }
    if (runtime.idleTimeoutSeconds !== undefined && (!Number.isFinite(runtime.idleTimeoutSeconds) || runtime.idleTimeoutSeconds <= 0)) issues.push(`Runtime ${runtime.id} idleTimeoutSeconds must be positive.`);
    for (const model of runtime.models ?? []) {
      if (!isNamespacedId(model.id)) issues.push(`Runtime ${runtime.id} has an invalid model id: ${model.id}.`);
      if (!/^[a-f0-9]{64}$/.test(model.sha256)) issues.push(`Runtime ${runtime.id} model ${model.id} requires a lowercase SHA-256 digest.`);
      if (!Number.isSafeInteger(model.size) || model.size <= 0) issues.push(`Runtime ${runtime.id} model ${model.id} requires a positive size.`);
      if (!model.version || !model.source || !model.license) issues.push(`Runtime ${runtime.id} model ${model.id} requires version, source, and license.`);
    }
  }

  const toolIds = new Set<string>();
  const toolRuntimeIds = new Map<string, string | undefined>();
  for (const tool of manifest.contributes.tools ?? []) {
    validateContributionId(tool.id, manifest.id, "Tool", issues);
    if (toolIds.has(tool.id)) issues.push(`Duplicate tool id: ${tool.id}`);
    toolIds.add(tool.id);
    toolRuntimeIds.set(tool.id, tool.runtimeId);
    if (tool.runtimeId && !runtimeIds.has(tool.runtimeId)) issues.push(`Tool ${tool.id} references unknown runtime ${tool.runtimeId}.`);
  }

  const operationIds = new Set<string>();
  for (const operation of manifest.contributes.operations ?? []) {
    validateContributionId(operation.id, manifest.id, "Operation", issues);
    if (operationIds.has(operation.id)) issues.push(`Duplicate operation id: ${operation.id}`);
    operationIds.add(operation.id);
    if (!toolIds.has(operation.toolId)) issues.push(`Operation ${operation.id} references unknown tool ${operation.toolId}.`);
    validateOperationSchema(operation.inputSchema, `${operation.id} inputSchema`, issues);
    validateOperationSchema(operation.outputSchema, `${operation.id} outputSchema`, issues);
    for (const permission of operation.permissions) {
      if (!manifest.permissions.includes(permission)) {
        issues.push(`Operation ${operation.id} uses undeclared permission ${permission}.`);
      }
    }
    if (operation.execution === "job" && !operation.timeoutSeconds) {
      issues.push(`Job operation ${operation.id} requires timeoutSeconds.`);
    }
    if (operation.timeoutSeconds !== undefined && (!Number.isFinite(operation.timeoutSeconds) || operation.timeoutSeconds <= 0)) issues.push(`Operation ${operation.id} timeoutSeconds must be positive.`);
    if (operation.accepts?.length && !operation.permissions.includes("artifact:read")) issues.push(`Operation ${operation.id} accepts artifacts and requires artifact:read permission.`);
    const operationRuntime = runtimesById.get(toolRuntimeIds.get(operation.toolId) ?? "");
    for (const permission of requiredRuntimePermissions(operationRuntime)) {
      if (!operation.permissions.includes(permission)) issues.push(`Operation ${operation.id} requires ${permission} permission because of its runtime.`);
    }
    if ((operation.resources?.network || operation.risk === "network-egress") && !operation.permissions.includes("network:use")) issues.push(`Operation ${operation.id} requires network:use permission.`);
    if (operation.resources?.gpu && !operation.permissions.includes("compute:gpu")) issues.push(`Operation ${operation.id} requires compute:gpu permission.`);
  }

  const providerIds = new Set<string>();
  for (const provider of manifest.contributes.contextProviders ?? []) {
    validateContributionId(provider.id, manifest.id, "Context provider", issues);
    if (!runtimeIds.has(provider.runtimeId)) issues.push(`Context provider ${provider.id} references unknown runtime ${provider.runtimeId}.`);
    if (!manifest.permissions.includes("artifact:read")) issues.push(`Context provider ${provider.id} requires artifact:read permission.`);
    if (runtimesById.get(provider.runtimeId)?.protocol === "mcp" && !provider.resourceUriTemplate) issues.push(`MCP context provider ${provider.id} requires resourceUriTemplate.`);
    providerIds.add(provider.id);
  }
  const artifactTypeIds = new Set(manifest.contributes.artifactTypes?.map((artifactType) => artifactType.id) ?? []);
  for (const artifactType of manifest.contributes.artifactTypes ?? []) {
    validateContributionId(artifactType.id, manifest.id, "Artifact type", issues);
    if (artifactType.context.mode === "custom" && !providerIds.has(artifactType.context.providerId)) {
      issues.push(`Artifact type ${artifactType.id} references unknown context provider ${artifactType.context.providerId}.`);
    }
  }
  for (const operation of manifest.contributes.operations ?? []) {
    for (const produced of operation.produces ?? []) {
      if (produced.startsWith(`${manifest.id}.`) && !artifactTypeIds.has(produced)) issues.push(`Operation ${operation.id} produces undeclared artifact type ${produced}.`);
    }
  }
  for (const theme of manifest.contributes.themes ?? []) {
    validateContributionId(theme.id, manifest.id, "Theme", issues);
    if (!isSafePackagePath(theme.tokens) || (theme.icons && !isSafePackagePath(theme.icons))) issues.push(`Theme ${theme.id} uses an unsafe resource path.`);
  }
  for (const connector of manifest.contributes.connectors ?? []) {
    validateContributionId(connector.id, manifest.id, "Connector", issues);
    if (!runtimeIds.has(connector.runtimeId)) issues.push(`Connector ${connector.id} references unknown runtime ${connector.runtimeId}.`);
    for (const permission of connector.permissions) if (!manifest.permissions.includes(permission)) issues.push(`Connector ${connector.id} uses undeclared permission ${permission}.`);
    for (const permission of ["artifact:create" as const, ...requiredRuntimePermissions(runtimesById.get(connector.runtimeId))]) {
      if (!connector.permissions.includes(permission)) issues.push(`Connector ${connector.id} requires ${permission} permission.`);
    }
    for (const produced of connector.produces) if (produced.startsWith(`${manifest.id}.`) && !artifactTypeIds.has(produced)) issues.push(`Connector ${connector.id} produces undeclared artifact type ${produced}.`);
  }
  for (const provider of manifest.contributes.modelProviders ?? []) {
    validateContributionId(provider.id, manifest.id, "Model provider", issues);
    if (!runtimeIds.has(provider.runtimeId)) issues.push(`Model provider ${provider.id} references unknown runtime ${provider.runtimeId}.`);
    const runtime = runtimesById.get(provider.runtimeId);
    if (runtime?.kind === "remote" && runtime.endpoint && isExternalEndpoint(runtime.endpoint) && provider.recipient !== "cloud") {
      issues.push(`Model provider ${provider.id} must declare cloud recipient for an external remote runtime.`);
    }
  }
  for (const view of manifest.contributes.views ?? []) {
    validateContributionId(view.id, manifest.id, "View", issues);
    if (!toolIds.has(view.toolId)) issues.push(`View ${view.id} references unknown tool ${view.toolId}.`);
    if (!isSafePackagePath(view.entry)) issues.push(`View ${view.id} entry must be a safe package-relative path.`);
  }

  return { valid: issues.length === 0, issues };
}

/** Represents the JSON Schema subset accepted for operation inputs and outputs. */
export type JsonSchema = Record<string, unknown>;

function validateContributionId(id: string, extensionId: string, label: string, issues: string[]): void {
  if (!isNamespacedId(id) || !id.startsWith(`${extensionId}.`)) {
    issues.push(`${label} id must use extension prefix ${extensionId}.`);
  }
}

function requiredRuntimePermissions(runtime?: RuntimeContribution): ExtensionPermission[] {
  if (!runtime) return [];
  return [...new Set<ExtensionPermission>([
    ...(runtime.kind === "remote" || runtime.resources?.network ? ["network:use" as const] : []),
    ...(runtime.kind === "native-process" ? ["native:execute" as const] : []),
    ...(runtime.lifecycle !== "job" ? ["background:run" as const] : []),
    ...(runtime.resources?.gpu ? ["compute:gpu" as const] : []),
    ...(runtime.models?.length ? ["models:use" as const] : [])
  ])];
}

// Unparseable endpoints are classified external so provider validation forces
// a "cloud" recipient declaration; malformed input must never earn local trust.
function isExternalEndpoint(endpoint: string): boolean {
  try { return !["127.0.0.1", "localhost", "::1"].includes(new URL(endpoint).hostname); }
  catch { return true; }
}

function isSafeRemoteEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname));
  } catch { return false; }
}

function validateOperationSchema(schema: JsonSchema, label: string, issues: string[], depth = 0, seen = new Set<object>()): void {
  if (depth > 100) { issues.push(`${label} exceeds maximum schema depth.`); return; }
  if (seen.has(schema)) { issues.push(`${label} contains an in-memory cycle.`); return; }
  seen.add(schema);
  if (typeof schema.$ref === "string" && schema.$ref !== "#" && !schema.$ref.startsWith("#/")) issues.push(`${label} may use only local $ref values.`);
  if (typeof schema.pattern === "string" && !isSafeSchemaPattern(schema.pattern)) issues.push(`${label} contains an unsafe or invalid regex pattern.`);
  for (const [key, value] of Object.entries(schema)) {
    if (key === "default" || key === "examples" || key === "const" || key === "enum") continue;
    if (Array.isArray(value)) {
      for (const child of value) if (isRecord(child)) validateOperationSchema(child, label, issues, depth + 1, seen);
    } else if (isRecord(value)) {
      if (["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"].includes(key)) {
        for (const child of Object.values(value)) if (isRecord(child)) validateOperationSchema(child, label, issues, depth + 1, seen);
      } else validateOperationSchema(value, label, issues, depth + 1, seen);
    }
  }
  seen.delete(schema);
}

function isSafeSchemaPattern(pattern: string): boolean {
  // Reject ReDoS-prone backreferences, lookahead/lookbehind, and nested quantifiers, and cap patterns at 512 characters.
  if (pattern.length > 512 || /\\[1-9]|\(\?[=!<]/.test(pattern) || /\([^)]*[+*][^)]*\)[+*{]/.test(pattern)) return false;
  try { new RegExp(pattern, "u"); return true; } catch { return false; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNamespacedId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]+$/.test(value) && value.includes(".");
}

function isSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function isSafePackagePath(value: string): boolean {
  const normalized = value.replaceAll("\\", "/");
  return Boolean(normalized) && !normalized.startsWith("/") && !normalized.split("/").includes("..");
}

// Compatibility layer for the experimental 0.1 command API.
/** Defines permissions supported by the experimental 0.1 compatibility API. */
export type LegacyPermission =
  | "project:read"
  | "project:write"
  | "notes:read"
  | "notes:write"
  | "assets:read"
  | "assets:write"
  | "commands:register"
  | "ai:use";

/** Describes a plugin manifest for the experimental 0.1 compatibility API. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  entry: string;
  permissions: LegacyPermission[];
  queryn: { minVersion: string };
}

/** Describes a command registered through the experimental 0.1 API. */
export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  run: CommandHandler;
}

/** Handles one command invocation in the experimental 0.1 API. */
export type CommandHandler = (context: CommandContext) => Promise<void> | void;

/** Provides project and UI access to a compatibility command. */
export interface CommandContext {
  project?: { rootPath: string; manifest: unknown };
  ui: { notify(message: string): void };
}

/** Registers commands exposed by a compatibility plugin. */
export interface CommandsApi { register(command: CommandDefinition): void }

/** Supplies a compatibility plugin with its manifest and command registry. */
export interface PluginContext { manifest: PluginManifest; commands: CommandsApi }

/** Defines a plugin for the experimental 0.1 compatibility API. */
export interface QuerynPlugin {
  manifest: PluginManifest;
  activate(context: PluginContext): Promise<void> | void;
  deactivate?(): Promise<void> | void;
}

/** Preserves the inferred type of a compatibility plugin definition. */
export function definePlugin(plugin: QuerynPlugin): QuerynPlugin { return plugin; }
