import { AsyncLocalStorage } from 'node:async_hooks';
import { homedir as osHomedir } from 'node:os';

const homeScope = new AsyncLocalStorage<{ value: string }>();

export function homedir(): string {
  return homeScope.getStore()?.value ?? osHomedir();
}

export function shellAnalysisHome(value: string): string {
  return homeScope.getStore()?.value ?? value;
}

export function withShellAnalysisHome<T>(value: string, callback: () => T): T {
  return homeScope.run({ value }, callback);
}
