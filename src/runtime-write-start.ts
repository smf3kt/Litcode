import type { ModelProvider } from './provider.js';
import type { Runtime, RuntimeOptions } from './runtime.js';
import type { Session, SessionConfig } from './session.js';
import type { ToolDefinition } from './tools.js';
import { writeFactorySchema } from './runtime-wrapper-observer.js';

type Owner = { owner: string; incarnation: string; live(session: Session): boolean };
export type RegisterRuntimeWrite = (tool: ToolDefinition, owner: Owner) => void;
const owners = new WeakMap<ToolDefinition, Owner>();

const register: RegisterRuntimeWrite = (tool, owner) => { owners.set(tool, owner); };

// Kt [121053,123737), UTF-16: the captured factory and calling session are distinct.
// This describes registration only, including when the scope check subsequently throws.
export function registeredWriteFactory(tool: ToolDefinition) {
  const registration = owners.get(tool);
  if (!registration) return;
  const parsed = writeFactorySchema.safeParse({ owner: registration.owner, incarnation: registration.incarnation });
  if (parsed.success) return Object.freeze(parsed.data);
}

// Kt/KWo, hwpb27as [121053,123737), sfn1dbxq [2275902,2308030), UTF-16;
// the recovered factory has no host Session journal or runtime-owner receipt.
export async function createRuntime(config: SessionConfig, provider: ModelProvider, signal: AbortSignal,
    options: RuntimeOptions = {}): Promise<Runtime> {
  const { createRuntimeAssembly } = await import('./runtime.js');
  return createRuntimeAssembly(config, provider, signal, register, options);
}

export function runtimeWriteOwner(tool: ToolDefinition, session: Session): { owner: string; incarnation: string } | undefined {
  try {
    const owner = owners.get(tool);
    return owner?.live(session) ? { owner: owner.owner, incarnation: owner.incarnation } : undefined;
  } catch { return; }
}
