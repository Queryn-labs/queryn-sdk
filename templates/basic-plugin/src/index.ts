import { defineExtension } from "@queryn/plugin-sdk";

export default defineExtension({
  manifest: {
    manifestVersion: "1",
    id: "queryn.example.note-linter",
    name: "Note Linter",
    version: "1.0.0",
    description: "Creates a portable report without writing to the project directly.",
    publisher: "queryn",
    license: "MIT",
    queryn: { minVersion: "0.2.0" },
    permissions: ["artifact:read", "artifact:create"],
    runtimes: [
      {
        id: "queryn.example.note-linter.runtime",
        kind: "node-process",
        lifecycle: "job",
        entry: "dist/index.js"
      }
    ],
    contributes: {
      tools: [
        {
          id: "queryn.example.note-linter.tool",
          title: "Note Linter",
          runtimeId: "queryn.example.note-linter.runtime"
        }
      ],
      artifactTypes: [
        {
          id: "queryn.example.note-linter.report",
          title: "Lint report",
          mediaTypes: ["text/markdown"],
          context: { mode: "automatic" }
        }
      ],
      operations: [
        {
          id: "queryn.example.note-linter.check",
          toolId: "queryn.example.note-linter.tool",
          version: "1",
          title: "Check note",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          outputSchema: { type: "object" },
          accepts: ["queryn.note"],
          produces: ["queryn.example.note-linter.report"],
          risk: "project-write",
          agentVisibility: "automatic",
          execution: "job",
          timeoutSeconds: 30,
          cancellable: true,
          idempotent: true,
          permissions: ["artifact:read", "artifact:create"]
        }
      ]
    }
  },
  operations: {
    "queryn.example.note-linter.check": async ({ artifacts, outboxPath }) => ({
      structured: { checked: artifacts.length },
      artifacts: [
        {
          type: "queryn.example.note-linter.report",
          title: "Lint report",
          payloads: [{ path: "report.md", mediaType: "text/markdown" }]
        }
      ]
    })
  }
});
