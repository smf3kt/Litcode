import { execFile } from 'node:child_process';

export type PeerIdleIdentityInput = { verifiedPeerPid?: number; childTokenPresented: boolean;
  needsVerdict: boolean; platform: string; selfPid?: number; selfSentAncestry?: number[] };
export type PeerIdleIdentity = (input: PeerIdleIdentityInput) => Promise<boolean>;
export type PeerIdleIdentityHost = {
  readStartToken: (pid: number, options: { skipCache: true }) => Promise<string | undefined>;
  run: typeof runPeerIdentityCommand;
};

// Bjn, 3sda67c1 [3812,4384), UTF-16; Node supplies the source command runner.
export function runPeerIdentityCommand(command: string, args: string[], options: { timeout: number }): Promise<{ code: number; stdout: string }> {
  return new Promise(resolve => {
    execFile(command, args, { ...options, encoding: 'utf8' }, (error, stdout) => resolve({ code: error === null ? 0 : 1, stdout }));
  });
}
