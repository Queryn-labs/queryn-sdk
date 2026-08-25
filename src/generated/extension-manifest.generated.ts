/* eslint-disable */
/**
 * Сгенерировано из контрактных схем osnova-spec (scripts/generate-contracts.mjs).
 * Не редактировать вручную: изменения вносятся в схемы и перегенерируются.
 */

export type NamespacedId = string;
export type Permission =
  | "project:read"
  | "artifact:read"
  | "artifact:create"
  | "network:use"
  | "models:use"
  | "models:install"
  | "compute:gpu"
  | "native:execute"
  | "external:apps"
  | "secrets:read"
  | "background:run";
export type Runtime = {
  [k: string]: unknown;
} & {
  id: NamespacedId;
  kind: RuntimeKind;
  lifecycle: RuntimeLifecycle;
  entry?: string;
  image?: string;
  endpoint?: string;
  protocol?: "osnova-tool-v1" | "mcp";
  idleTimeoutSeconds?: number;
  resources?: Resources;
  models?: ModelDependency[];
};
export type RuntimeKind = "builtin" | "node-process" | "native-process" | "oci" | "remote";
export type RuntimeLifecycle = "job" | "project" | "shared";
export type OperationRisk = "safe-read" | "project-write" | "network-egress" | "external-side-effect" | "privileged";
export type ArtifactContextBinding =
  | {
      mode: "none" | "automatic";
    }
  | {
      mode: "declarative";
      fields: string[];
    }
  | {
      mode: "custom";
      providerId: NamespacedId;
    };

export interface ExtensionManifest {
  manifestVersion: "1";
  id: NamespacedId;
  name: string;
  version: string;
  description?: string;
  publisher?: string;
  license?: string;
  osnova: {
    minVersion: string;
  };
  permissions: Permission[];
  runtimes?: Runtime[];
  contributes: ExtensionContributions;
}
export interface Resources {
  cpu?: number;
  memoryMb?: number;
  diskMb?: number;
  gpu?: boolean;
  network?: boolean;
}
export interface ModelDependency {
  id: NamespacedId;
  version: string;
  source: string;
  sha256: string;
  size: number;
  license: string;
  platforms?: ("win32" | "darwin")[];
  architectures?: ("x64" | "arm64")[];
}
export interface ExtensionContributions {
  themes?: Theme[];
  tools?: Tool[];
  operations?: Operation[];
  artifactTypes?: ArtifactType[];
  contextProviders?: ContextProvider[];
  connectors?: Connector[];
  modelProviders?: ModelProvider[];
  views?: View[];
}
export interface Theme {
  id: NamespacedId;
  title: string;
  tokens: string;
  icons?: string;
}
export interface Tool {
  id: NamespacedId;
  title: string;
  description?: string;
  runtimeId?: NamespacedId;
}
export interface Operation {
  id: NamespacedId;
  toolId: NamespacedId;
  version: string;
  title: string;
  description?: string;
  inputSchema: {
    [k: string]: unknown;
  };
  outputSchema: {
    [k: string]: unknown;
  };
  accepts?: NamespacedId[];
  produces?: NamespacedId[];
  risk: OperationRisk;
  agentVisibility: "hidden" | "explicit" | "automatic";
  execution: "immediate" | "job";
  timeoutSeconds?: number;
  cancellable?: boolean;
  idempotent?: boolean;
  permissions: Permission[];
  resources?: Resources;
}
export interface ArtifactType {
  id: NamespacedId;
  title: string;
  mediaTypes?: string[];
  context: ArtifactContextBinding;
}
export interface ContextProvider {
  id: NamespacedId;
  artifactTypes: NamespacedId[];
  version: string;
  runtimeId: NamespacedId;
  resourceUriTemplate?: string;
}
export interface Connector {
  id: NamespacedId;
  title: string;
  runtimeId: NamespacedId;
  scope: "project" | "external-explicit";
  produces: NamespacedId[];
  permissions: Permission[];
}
export interface ModelProvider {
  id: NamespacedId;
  title: string;
  runtimeId: NamespacedId;
  recipient: "local" | "cloud";
  capabilities: ("chat" | "vision" | "embeddings" | "structured-output")[];
}
export interface View {
  id: NamespacedId;
  title: string;
  toolId: NamespacedId;
  entry: string;
}
