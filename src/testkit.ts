import type {
  ExtensionPermission,
  OperationContext,
  OperationDefinition,
  OperationResult,
  QuerynExtension
} from "./index.js";

export interface TestInvocation {
  operationId: string;
  input?: Record<string, unknown>;
  grantedPermissions?: ExtensionPermission[];
  context?: Partial<OperationContext>;
}

export async function invokeTestOperation(extension: QuerynExtension, invocation: TestInvocation): Promise<OperationResult> {
  const definition = extension.manifest.contributes.operations?.find((item) => item.id === invocation.operationId);
  if (!definition) throw new Error(`Unknown operation: ${invocation.operationId}`);
  const handler = extension.operations?.[invocation.operationId];
  if (!handler) throw new Error(`Missing operation handler: ${invocation.operationId}`);
  assertPermissions(definition, invocation.grantedPermissions ?? extension.manifest.permissions);
  assertSchema(definition.inputSchema, invocation.input ?? {});

  const abortController = new AbortController();
  return handler({
    jobId: "test-job",
    projectId: "test-project",
    input: invocation.input ?? {},
    artifacts: [],
    outboxPath: "/tmp/queryn-extension-test-outbox",
    signal: abortController.signal,
    reportProgress: () => undefined,
    ...invocation.context
  });
}

function assertPermissions(definition: OperationDefinition, granted: ExtensionPermission[]): void {
  const missing = definition.permissions.filter((permission) => !granted.includes(permission));
  if (missing.length > 0) throw new Error(`Missing permissions: ${missing.join(", ")}`);
}

function assertSchema(schema: Record<string, unknown>, value: Record<string, unknown>): void {
  if (schema.type === "object" && typeof value !== "object") throw new Error("Operation input must be an object.");
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (typeof key === "string" && !(key in value)) throw new Error(`Missing required input: ${key}`);
  }
}
