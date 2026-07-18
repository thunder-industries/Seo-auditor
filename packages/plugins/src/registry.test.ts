import { describe, expect, it } from "vitest";
import { PluginRegistry } from "./registry.js";
import type { AuditContext, AuditPlugin, Finding } from "./types.js";
import type { ParsedPage } from "@seo-auditor/parser";

function makePlugin(name: string, findings: Finding[]): AuditPlugin {
  return {
    name,
    version: "0.1.0",
    category: "test",
    scope: "page",
    run: () => findings
  };
}

describe("PluginRegistry", () => {

  it("runs all registered plugins and flattens their findings", async () => {
    const registry = new PluginRegistry();

    registry.registerAll([
      makePlugin("a", [{ pluginName: "a", category: "test", severity: "warning", message: "x" }]),
      makePlugin("b", [
        { pluginName: "b", category: "test", severity: "info", message: "y" },
        { pluginName: "b", category: "test", severity: "critical", message: "z" }
      ])
    ]);

    const findings = await registry.runAll(
      {} as ParsedPage,
      {} as AuditContext
    );

    expect(findings).toHaveLength(3);
    expect(registry.getAll()).toHaveLength(2);
  });

  it("supports async plugin.run implementations", async () => {
    const registry = new PluginRegistry();

    registry.register({
      name: "async-plugin",
      version: "0.1.0",
      category: "test",
      scope: "page",
      run: async () => [{ pluginName: "async-plugin", category: "test", severity: "info", message: "ok" }]
    });

    const findings = await registry.runAll({} as ParsedPage, {} as AuditContext);
    expect(findings).toHaveLength(1);
  });

});
