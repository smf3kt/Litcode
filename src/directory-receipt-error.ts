// The native writer emits "error FAMILY ERRNO\n", then main writes "exit 1\n".
// The reader may observe any prefix after a crash between writes.
export function matchesNativeErrorPrefix(trailer: string, family: string): boolean {
  const start = `error ${family} `;
  if (start.startsWith(trailer)) return trailer.length > 0;
  if (!trailer.startsWith(start)) return false;
  const match = /^(0|[1-9][0-9]{0,9})(?:\n(.*))?$/s.exec(trailer.slice(start.length));
  return !!match && Number(match[1]) <= 0x7fffffff &&
    (match[2] === undefined || 'exit 1\n'.startsWith(match[2]));
}
