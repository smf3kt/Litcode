import crypto from 'node:crypto';
import path from 'node:path';
import { matchesNativeErrorPrefix } from './directory-receipt-error.js';
import { isDeepStrictEqual } from 'node:util';
import { directoryFileObservationFrame, parseDirectoryFileObservationFrame, probeMissingDirectoryFile, readStableDirectoryFile } from './directory-file-state.js';
import { DIRECTORY_REWIND_BYTE_CAP, type DirectoryRewindEvidence, type DirectoryPreparation } from './directory-rewind-evidence.js';
import type { Session } from './session.js';

type Operation = DirectoryRewindEvidence['operations'][number];
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');

// EVr/RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4743506). Host no-effect proof preserves all retained objects.
// Historical inverse attempts verify their orphaned objects, not a target that
// a later, separately recorded inverse may legitimately have changed.
export function noEffectDirectoryVerifier(bytes: Buffer, operation: Operation, reverse: boolean, id: string, source: Session, signal: AbortSignal,
  preparation?: DirectoryPreparation) {
  operation = structuredClone(operation);
  if ((reverse ? operation.rollbackContinuation : operation.continuation)?.id === id) return;
  const from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  const kind = to.kind === 'missing' ? 'remove' : from.kind === 'present' ? 'replace' : 'create';
  const raw = bytes.toString('utf8');
  const errorIndex = kind === 'create' ? -1 : raw.indexOf('\ne');
  const error = errorIndex >= 0 ? raw.slice(errorIndex + 1) : undefined;
  const text = error === undefined ? raw : raw.slice(0, errorIndex + 1);
  const pattern = kind === 'remove' ? /^directory-write-receipt-v2\nstart\nchecking\nintent remove (v2:[^\n ]+) (missing:[0-9]+:[0-9]+)\n(?:committing\n)?$/ :
    kind === 'replace' ? /^directory-write-receipt-v2\nstart\nstaging\nchecking\nintent replace (v2:[^\n ]+) (v2:[^\n ]+)\n(?:capturing\n)?$/ :
      /^directory-write-receipt-v2\nstart\nstaging\npublishing\nintent create (\.litcode-tmp-[0-9]+-[0-9]+) (v2:[^\n ]+)\n(?:committing\n)?$/;
  const intent = pattern.exec(text);
  let expected = from.kind === 'present' ? from.observation : undefined;
  if (from.kind === 'present') {
    if (reverse) {
      if (operation.stage.kind !== 'completed' || operation.stage.result.kind !== 'durable') return;
      expected = operation.stage.result.observation;
    }
  }
  const prefix = expected && kind !== 'create' ? `directory-write-receipt-v2\nstart\n${kind === 'replace' ? 'staging\n' : ''}checking\nintent ${kind} ${directoryFileObservationFrame(expected)} ` : undefined;
  const early = prefix !== undefined && (prefix.startsWith(text) || (text.startsWith(prefix) && !text.slice(prefix.length).includes('\n')));
  if (!intent && !early) return;
  const grant = source.workingDirectories(false).readHandle?.(operation.grant.root);
  if (!grant || grant.owner !== source.id || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
    throw new Error('External rewind requires an explicit grant for the original directory');
  const relative = path.relative(grant.root, operation.path), directory = path.dirname(relative);
  const authority = () => {
    signal.throwIfAborted(); source.checkpointGateIdentity();
    const current = source.workingDirectories(false).readHandle?.(grant.root);
    if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased || !current || current.fd !== grant.fd ||
        current.incarnation !== grant.incarnation || current.owner !== source.id || current.dev !== grant.dev || current.ino !== grant.ino ||
        grant.signal.aborted || current.signal.aborted) throw new Error('External rewind no-effect authority changed');
  };
  const read = (relative: string) => readStableDirectoryFile({ fd: grant.fd, relative, sync: true }, DIRECTORY_REWIND_BYTE_CAP, signal);
  const missing = (relative: string) => probeMissingDirectoryFile({ fd: grant.fd, relative, sync: true });
  const targetUnchanged = () => {
    authority();
    if (from.kind === 'missing') return isDeepStrictEqual(missing(relative), from.parent);
    const file = read(relative);
    return !!file && isDeepStrictEqual(file.observation, expected) && file.bytes.length === from.content.bytes && hash(file.bytes) === from.content.sha256;
  };
  if (early && prefix && expected) {
    // EVr/RVr ranges above. A known-ID orphan snapshot is retained evidence,
    // not backup bytes or authority to publish/remove its contents.
    if (!preparation && !targetUnchanged()) return;
    const retained = path.join(directory, `.litcode-${kind}-${id}`);
    const snapshot = (): DirectoryPreparation => {
      authority();
      if (isDeepStrictEqual(missing(retained), expected.parent)) { authority(); return { kind: 'absent', parent: expected.parent }; }
      const file = read(path.join(retained, 'staged'));
      const parent = file?.observation.parent ?? missing(path.join(retained, 'staged'));
      if (!parent || !isDeepStrictEqual(missing(path.join(retained, 'held')), parent)) throw new Error('External rewind early no-effect retained state unresolved');
      authority();
      return { kind: 'retained', staged: file ? { kind: 'present', observation: file.observation,
        content: { bytes: file.bytes.length, sha256: hash(file.bytes) } } : { kind: 'missing', parent } };
    };
    const saved = preparation ? structuredClone(preparation) : snapshot();
    if (error !== undefined) {
      // EVr/RVr above. The native writer sets created immediately after mkdir.
      // Its terminal family must agree with both its status and the saved names.
      const start = 'directory-write-receipt-v2\nstart\n';
      const family = saved.kind === 'retained' ? 'unknown' : kind === 'remove' ? 'not_removed' : 'not_published';
      let consistent: boolean;
      if (saved.kind === 'absent') {
        consistent = text === start || (kind === 'remove' && text === start + 'checking\n');
      } else if (kind === 'remove') {
        consistent = text === start + 'checking\n' && saved.staged.kind === 'missing';
      } else if (saved.staged.kind === 'missing') {
        consistent = text === start;
      } else {
        const staged = saved.staged;
        consistent = to.kind === 'present' && staged.content.bytes <= to.content.bytes &&
          (text === start + 'staging\n' || (text === start + 'staging\nchecking\n' &&
            staged.observation.mode === to.observation.mode && isDeepStrictEqual(staged.content, to.content)));
      }
      if (!consistent || !matchesNativeErrorPrefix(error, family)) throw new Error('External rewind no-effect error phase differs');
    }
    if (text.startsWith(prefix)) {
      if (saved.kind !== 'retained') throw new Error('External rewind early no-effect intent changed');
      const staged = saved.staged;
      const frame = kind === 'remove' && staged.kind === 'missing' ? `missing:${staged.parent.dev}:${staged.parent.ino}` :
        kind === 'replace' && staged.kind === 'present' && to.kind === 'present' && isDeepStrictEqual(staged.content, to.content) &&
        staged.observation.mode === to.observation.mode && staged.observation.nlink === '1' &&
        !(staged.observation.dev === expected.dev && staged.observation.ino === expected.ino) ? directoryFileObservationFrame(staged.observation) : undefined;
      if (!frame || !`${prefix}${frame}\n`.startsWith(text)) throw new Error('External rewind early no-effect intent changed');
    }
    const verifyRetained = () => {
      if (!isDeepStrictEqual(snapshot(), saved)) throw new Error('External rewind early no-effect retained state changed');
    };
    verifyRetained();
    return { preparation: structuredClone(saved), targetUnchanged, verifyRetained, verify: () => {
      if (!targetUnchanged()) throw new Error('External rewind no-effect target changed');
      verifyRetained();
    } };
  }
  if (!intent || preparation) return;
  if (error !== undefined && !matchesNativeErrorPrefix(error, 'unknown')) return;
  if (from.kind === 'present' && !isDeepStrictEqual(parseDirectoryFileObservationFrame(intent[1]!), expected)) return;
  const staged = kind === 'remove' ? undefined : parseDirectoryFileObservationFrame(intent[2]!);
  if (staged && (to.kind !== 'present' || staged.mode !== to.observation.mode || staged.size !== String(to.content.bytes) || staged.nlink !== '1')) return;
  if (kind === 'create' && (from.kind !== 'missing' || !isDeepStrictEqual(staged?.parent, from.parent))) return;
  const verifyRetained = () => {
    authority();
    const retained = path.join(directory, `.litcode-${kind}-${id}`);
    if (staged && to.kind === 'present') {
      const file = read(kind === 'create' ? path.join(directory, intent[1]!) : path.join(retained, 'staged'));
      if (!file || !isDeepStrictEqual(file.observation, staged) || file.bytes.length !== to.content.bytes || hash(file.bytes) !== to.content.sha256)
        throw new Error('External rewind no-effect staged file changed');
    }
    if (kind === 'replace') {
      if (!isDeepStrictEqual(missing(path.join(retained, 'held')), staged?.parent)) throw new Error('External rewind no-effect retained path changed');
    } else if (kind === 'remove') {
      const parent = missing(path.join(retained, 'held'));
      if (!parent || `missing:${parent.dev}:${parent.ino}` !== intent[2]) throw new Error('External rewind no-effect retained path changed');
    }
    authority();
  };
  return { preparation: undefined, targetUnchanged, verifyRetained, verify: () => {
    if (!targetUnchanged()) throw new Error('External rewind no-effect target changed');
    verifyRetained();
  } };
}
