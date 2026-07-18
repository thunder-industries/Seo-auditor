import type { ParsedPage } from "@seo-auditor/parser";
import type { AuditContext, AuditPlugin, Finding } from "./types.js";

export class PluginRegistry {

  private plugins: AuditPlugin[] = [];

  register(plugin: AuditPlugin): void {
    this.plugins.push(plugin);
  }

  registerAll(plugins: AuditPlugin[]): void {
    for (const plugin of plugins) this.register(plugin);
  }

  getAll(): AuditPlugin[] {
    return [...this.plugins];
  }

  async runAll(page: ParsedPage, context: AuditContext): Promise<Finding[]> {
    const results = await Promise.all(
      this.plugins.map(plugin => plugin.run(page, context))
    );
    return results.flat();
  }

}
