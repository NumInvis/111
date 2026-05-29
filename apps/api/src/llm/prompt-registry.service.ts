import { Injectable } from '@nestjs/common';
import { PromptRegistry } from '@variational-infinity/ai';

@Injectable()
export class PromptRegistryService {
  private readonly registry = new PromptRegistry();

  get(name: string) {
    return this.registry.get(name);
  }

  list() {
    return this.registry.list();
  }

  render(name: string, variables: Record<string, string>): string {
    return this.registry.render(name, variables);
  }

  register(entry: { name: string; version: string; content: string; description: string }): void {
    this.registry.register(entry);
  }
}