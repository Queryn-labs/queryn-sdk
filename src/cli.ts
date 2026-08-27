#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { packExtension } from "./package.js";
import { validateExtensionManifest, type ExtensionManifest } from "./index.js";

const [command = "help", ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (command) {
    case "init":
      await initExtension(args[0] ?? "queryn-extension", option(args, "--template") ?? "tool");
      return;
    case "lint":
    case "test":
      await lintManifest(args[0] ?? "extension.json");
      return;
    case "pack":
      await packExtension(path.resolve(args[0] ?? "."), path.resolve(args[1] ?? ".queryn-package.json"));
      process.stdout.write("Extension package created.\n");
      return;
    case "dev":
      await lintManifest(path.join(args[0] ?? ".", "extension.json"));
      process.stdout.write(`Developer extension ready: ${path.resolve(args[0] ?? ".")}\n`);
      return;
    case "doctor":
      process.stdout.write(`Node ${process.version}\nPlatform ${process.platform}/${process.arch}\nSDK ready\n`);
      return;
    default:
      process.stdout.write("queryn extension <init|lint|test|pack|dev|doctor>\n\ninit DIRECTORY --template <theme|note-linter|tool|advanced|oci|mcp>\n");
  }
}

async function lintManifest(filePath: string): Promise<void> {
  const manifest = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as ExtensionManifest;
  const result = validateExtensionManifest(manifest);
  if (!result.valid) throw new Error(result.issues.join("\n"));
  process.stdout.write(`${manifest.id}@${manifest.version} is valid.\n`);
}

async function initExtension(directory: string, template: string): Promise<void> {
  const rootPath = path.resolve(directory);
  const id = `queryn.local.${path.basename(rootPath).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  await mkdir(path.join(rootPath, "src"), { recursive: true });
  const manifest = createTemplateManifest(id, path.basename(rootPath), template);
  await writeFile(path.join(rootPath, "extension.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  await writeFile(path.join(rootPath, "package.json"), `${JSON.stringify({
    name: id.replaceAll(".", "-"), version: "0.1.0", private: true, type: "module",
    scripts: {
      build: "tsc -p tsconfig.json",
      lint: "queryn-extension lint extension.json",
      test: "queryn-extension test extension.json",
      pack: "queryn-extension pack . ./extension.queryn-package.json",
      dev: "queryn-extension dev ."
    },
    dependencies: { "@queryn/plugin-sdk": "^0.2.0" },
    devDependencies: { typescript: "^5.7.3" }
  }, null, 2)}\n`, { flag: "wx" });
  await writeFile(path.join(rootPath, "tsconfig.json"), `${JSON.stringify({
    compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, resolveJsonModule: true, rootDir: "src", outDir: "dist" },
    include: ["src/**/*.ts"]
  }, null, 2)}\n`, { flag: "wx" });
  await writeFile(path.join(rootPath, ".gitignore"), "node_modules/\ndist/\n*.queryn-package.json\n", { flag: "wx" });
  await writeFile(path.join(rootPath, "src", "index.ts"), "import { defineExtension, type ExtensionManifest } from '@queryn/plugin-sdk';\n\nconst manifest = await import('../extension.json', { with: { type: 'json' } }).then((module) => module.default) as ExtensionManifest;\nexport default defineExtension({ manifest });\n", { flag: "wx" });
  if (template === "theme") await writeFile(path.join(rootPath, "tokens.json"), `${JSON.stringify({ "surface.canvas": "#121212", "text.primary": "#f4f0ed", "accent.primary": "#d12f6a" }, null, 2)}\n`, { flag: "wx" });
  if (["note-linter", "tool", "advanced"].includes(template)) await writeFile(path.join(rootPath, "server.mjs"), processServerTemplate(id), { flag: "wx" });
  if (template === "oci") {
    await writeFile(path.join(rootPath, "server.mjs"), processServerTemplate(id), { flag: "wx" });
    await writeFile(path.join(rootPath, "Dockerfile"), "FROM node:22-alpine\nWORKDIR /app\nCOPY server.mjs /app/server.mjs\nUSER 65532:65532\nENTRYPOINT [\"node\", \"/app/server.mjs\"]\n", { flag: "wx" });
  }
  await writeFile(path.join(rootPath, "README.md"), `# ${path.basename(rootPath)}\n\nGenerated from the Queryn ${template} template.\n`, { flag: "wx" });
  process.stdout.write(`Created ${rootPath} from ${template} template.\n`);
}

function createTemplateManifest(id: string, name: string, template: string): ExtensionManifest {
  if (!new Set(["theme", "note-linter", "tool", "advanced", "oci", "mcp"]).has(template)) throw new Error(`Unknown template: ${template}`);
  const base = { manifestVersion: "1" as const, id, name, version: "0.1.0", queryn: { minVersion: "0.2.0" } };
  if (template === "theme") return { ...base, permissions: [], contributes: { themes: [{ id: `${id}.theme`, title: name, tokens: "tokens.json" }] } };
  const runtimeId = `${id}.runtime`;
  const toolId = `${id}.tool`;
  const operationId = `${id}.run`;
  const artifactType = `${id}.output`;
  const runtime = template === "mcp"
    ? { id: runtimeId, kind: "remote" as const, lifecycle: "shared" as const, endpoint: "http://127.0.0.1:3999/mcp", protocol: "mcp" as const, resources: { network: true } }
    : template === "oci"
      ? { id: runtimeId, kind: "oci" as const, lifecycle: "job" as const, image: "replace.example/tool@sha256:0000000000000000000000000000000000000000000000000000000000000000", resources: { cpu: 1, memoryMb: 512, network: false } }
      : { id: runtimeId, kind: "node-process" as const, lifecycle: template === "advanced" ? "project" as const : "job" as const, entry: "server.mjs", resources: { cpu: 1, memoryMb: template === "advanced" ? 512 : 128, network: false } };
  const permissions = template === "mcp"
    ? ["network:use" as const, "background:run" as const]
    : ["artifact:create" as const, ...(template === "note-linter" ? ["artifact:read" as const] : []), ...(template === "advanced" ? ["background:run" as const] : [])];
  return {
    ...base, permissions, runtimes: [runtime],
    contributes: {
      tools: [{ id: toolId, title: name, runtimeId }],
      operations: [{
        id: operationId, toolId, version: "1.0.0", title: template === "note-linter" ? "Check note" : "Run",
        inputSchema: { type: "object", properties: { text: { type: "string" } } }, outputSchema: { type: "object" },
        produces: template === "mcp" ? [] : [artifactType], risk: template === "mcp" ? "network-egress" : "project-write",
        agentVisibility: "explicit", execution: "job", timeoutSeconds: 60, cancellable: true, idempotent: true, permissions
      }],
      artifactTypes: template === "mcp" ? [] : [{ id: artifactType, title: "Output", mediaTypes: ["text/markdown"], context: { mode: "automatic" } }]
    }
  };
}

function processServerTemplate(id: string): string {
  return `import { writeFile } from "node:fs/promises";\nimport path from "node:path";\nimport readline from "node:readline";\nreadline.createInterface({ input: process.stdin }).on("line", async (line) => {\n  const request = JSON.parse(line); if (request.id === undefined) return;\n  try {\n    if (request.method === "initialize") return reply(request.id, { protocolVersion: "1" });\n    if (request.method === "health") return reply(request.id, { status: "ready" });\n    if (request.method === "shutdown") return reply(request.id, { ok: true });\n    if (request.method !== "jobs/start") throw new Error("Unknown method");\n    await writeFile(path.join(request.params.paths.outbox, "output.md"), String(request.params.input.text ?? "Queryn output"));\n    reply(request.id, { structured: { ok: true }, artifacts: [{ type: "${id}.output", payloads: [{ path: "output.md", mediaType: "text/markdown" }], context: { mode: "automatic" } }] });\n  } catch (error) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error.message } }) + "\\n"); }\n});\nfunction reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n"); }\n`;
}

function option(values: string[], name: string): string | undefined {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
