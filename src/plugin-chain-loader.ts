// The product's entry into the copied module loader: a chain run, the descriptor a load takes, and
// the unload side of the cleanup owner.
//
// `tGe` in ./plugin-chain-loader-source.ts is the source's own loader; what it needs from outside is
// a run to count environments in and a host to load them into. This module supplies both and owns
// the one thing the loader leaves to its caller: the record it returns is pushed onto the loaded
// module inventory, and unloading takes it back off and tears the environment down.
import fs from 'node:fs';
import path from 'node:path';
import { it, AK } from './plugin-chain-host.js';
import { loadChainModuleFile, type LoadedChainModuleFile } from './plugin-chain-module-host.js';
import { tGe } from './plugin-chain-loader-source.js';
import type { ChainEnvironmentDescriptor, ChainModule, ChainModuleRecord, ChainRun } from './plugin-chain-types.js';

/** A loaded module's record, as the loader builds it: the module record plus the teardown paths the
 *  loader adds (`terminate`, `retire`, `discard`). */
export type ChainRunRecord = ChainModuleRecord & { terminate?: () => void; retire?: () => void; discard?: () => void };

/** A loaded chain module and the one call that ends it. */
export interface LoadedChainModule {
  record: ChainRunRecord;
  unload: () => void;
}

/** A fresh run: the environment counter and the argument table the copied `tGe` reads and writes. */
export function createChainRun(): ChainRun {
  return { state: { environmentCounter: 0, environmentArgs: new Map() } };
}

/** The product's step around the loader. The source's plugin loader keeps its own admitted-module
 *  list and replaces `it().loadedModules` wholesale once an install is admitted; this product has one
 *  install path and no admission queue, so the record the loader returns joins that inventory
 *  directly and the plugin's removal is what takes it back out.
 *
 *  The removal itself mirrors the source's plugin-removal path rather than its host-death path: the
 *  record is *retired*, which drops the module's commands and agents, marks it retiring and tears the
 *  environment down once no dispatch is in flight (`terminate` is what the source calls when the
 *  runtime itself is replaced, which is not this event). */
export async function loadChainModule(run: ChainRun, descriptor: ChainEnvironmentDescriptor): Promise<LoadedChainModule> {
  const record = (await tGe(run, descriptor)) as ChainRunRecord;
  it().loadedModules.push(record);
  return {
    record,
    unload: () => {
      const at = it().loadedModules.indexOf(record);
      if (at >= 0) it().loadedModules.splice(at, 1);
      AK.forgetPresses(descriptor.pluginName);
      record.retire?.();
    },
  };
}

/** What the product asks a load for: the plugin's identity, where its module file is, and its tier. */
export interface ChainModuleRequest {
  pluginName: string;
  modulePath: string;
  /** The plugin's install identity, which is its own directory; `D5t` composes the label from it. */
  storageId?: string;
  tier?: string;
}

/** Loads one plugin's hooks module file through the copied loader.
 *
 *  Before the read, the module must be a real file inside the plugin's own folder: source `X3e`
 *  (chunk-m4qpskd4.js [5839,6300)) resolves the specifier and throws
 *  `` `${plugin}: ${root}: ${resolved} resolves outside the plugin's folder` `` or
 *  `` `${plugin}: ${root}: not a regular file` ``. Discovery already resolved the path inside the
 *  snapshot, so this is the source's own guard at the read, not this product's check.
 *
 *  The scan `iWt` checks the registration against is the module's own handler table: a plugin that
 *  registers a pattern it has no handler for is refused at load, exactly as the source refuses one
 *  whose hooks module the scan did not see. */
export async function loadChainModuleFileInto(run: ChainRun, request: ChainModuleRequest): Promise<LoadedChainModule> {
  if (request.storageId !== undefined) {
    const root = path.resolve(request.storageId);
    const resolved = path.resolve(request.modulePath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`${request.pluginName}: ${root}: ${resolved} resolves outside the plugin's folder`);
    }
    if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`${request.pluginName}: ${root}: not a regular file`);
    }
  }
  const loaded: LoadedChainModuleFile = await loadChainModuleFile(request.modulePath);
  return await loadChainModule(run, descriptorFor(request, loaded));
}

/** The descriptor the copied loader takes, built from the product's plugin identity. */
export function descriptorFor(request: ChainModuleRequest, loaded: LoadedChainModuleFile): ChainEnvironmentDescriptor {
  const module: ChainModule = loaded.module;
  const storageId = request.storageId ?? request.modulePath.slice(0, request.modulePath.lastIndexOf('/'));
  return {
    pluginName: request.pluginName,
    pluginStorageId: storageId,
    tier: request.tier ?? module.tier,
    spec: { name: request.pluginName },
    modulePath: request.modulePath,
    module,
    scan: { hooks: loaded.hookEvents },
  };
}
