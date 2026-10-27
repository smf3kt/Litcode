# W365 unified local agent messaging

Status: implementation, main verification and independent VERIFIED_SCOPED. Base commit448cc39306b7f7d8d62070bed23ba93ad5c87c2b. One active package.

## Task card

ID: W365, one local roster and message route for owned children and same-host peers.
User chain: list_agents lists both local kinds with source name/ref disambiguation, then send_message selects the existing child mailbox or authenticated peer transport. Optional peer idle subscription retains W364 ownership.
Source: ListAgentsTool in chunk-w520ws9s, local roster in chunk-w9kaj2q7, candidate/name/ref owners in chunk-m7864yc0 and chunk-n2jtmdcb, local SendMessage branches in chunk-1fr2177j.
Targets: one typed messaging adapter, exact pure source copies, runtime owner binding, interactive peer lifetime, strict feature readers and the existing compiled peer driver.
Mode: copy obtainable pure name/ref and row functions. Adapt source app state to the existing child registry and local peer records. Account, remote and hosted rows are excluded.
Compatibility: pinned unifiedAgentMessaging flag defaults true for fresh CLI and accepted reload. Original absent/false sessions retain their previous schemas and behavior. crossSessionMessaging remains the inbox gate.
Predicate: actual compiled CLI lists both kinds, resolves a child/peer name collision, delivers once to the selected owner, handles combined or pure peer idle subscription, preserves cold journals and releases resources.
Checks: at most three new behavior groups, baseline before product edits, affected tests, check/build, actual compiled CLI, frozen source/input/build identity and one independent correctness review.

## Existing owners

AgentRegistry owns children, their session journals, serialized mailboxes and child idle subscriptions. Its list_agents and send_message currently see only those children. LocalPeerTransport owns process-verified UDS discovery, delivery, receipts, held input and peer idle subscriptions. interactiveLoop adds those peer tools after Runtime.buildTools. Runtime already owns each child registry through an owner-scoped lazy accessor and invalidates all retained tools when that owner is released.

## Design sketch

Candidate A binds the existing LocalPeerTransport to the Runtime owner through one map. A typed unified factory receives the child registry and a live peer getter. It uses one source candidate resolver for both listing refs and delivery selection, then delegates effects to the existing mailbox or transport. Runtime release drops the binding and the existing scope check rejects stale tools. Interactive startup and accepted successors bind the current inbox. Schema construction stays independent of resource allocation.

Candidate B decorates tools in interactiveLoop and parses the existing list_agents JSON to obtain child state. That shape duplicates the registry boundary, loses typed ownership, and makes headless/MCP schema admission depend on a separate tool wrapper. Reject B.

Select A. The state shape is an owner-scoped transport binding plus immutable candidate snapshots. Local effects keep their current owners. The new adapter owns selection, the source-formatted listing and the neutral result data. The new flag selects the entire list/send contract, so compatibility does not depend on whether a peer happens to be running. README documents local discovery,selectors,pure idle subscriptions andlegacy feature selection.

Sketch boundaries before implementation:

- Runtime.bindPeerMessaging(owner, transport) installs the live peer binding after inbox publication.
- createUnifiedAgentTools(registry, peerGetter, options) returns list_agents and send_message plus the existing unrelated agent controls.
- Source candidate and name/ref helpers receive typed child/peer snapshots. Source rendering receives candidates and locally projected rows.
- LocalPeerTransport supplies live records through its existing discovery owner. list_peers retains its old result shape.
- A named peer send resolves once, pins PID/birth to the selected record, sends text once and then records an optional idle subscription. An uncertain send is returned without replay.
- Pure peer subscriptions create no recipient turn. Child subscriptions retain AgentRegistry's existing lifetime and notification owner.

Source preflight records the complete name/candidate/resolver and local delivery owners before product edits. Main capture w365-main-source.json has SHA-256fcf215ab40ea7cd5461538ee6c0c35d60fc1542d7a3fb1a13238c042e75c989e. The current persistent plan W365-agent-messaging-source-plan.json has SHA-256294bc0cc448c949b1a8311021f476d791e12d886256ed8e16e3150418f5df345 and stages four files with112exact declarations. The bounded resolver reader supplies w365-name-resolver-source.json SHA-2567d9b8793c154c8408751033e616b9a2016a991ff4e78e40d65083e6b7958b63a after38calls against12requested. Its claim that xue caps UTF16 units is corrected by the complete body,which spreads code points before slicing200entries. No declaration was reported unavailable.

Exact source anchors use zero-based half-open UTF16 units. ListAgentsTool is chunk-w520ws9s.js SHA-256f4ff3c58e14dcc09ab69d486c0364f58739de522bd0da742a853accf48689805 [5912,7382). Roster collection/formatting is chunk-w9kaj2q7.js SHA-256c9f40c6995b02e693505c0f8c86273286f00a7b85187d878cb69e8f21d5d380e [1484,5952),pure rows[7672,9025). Candidate/ref owner chunk-m7864yc0.js SHA-256190465da91f131a8ccd7708ae318757359ebe9f53bc32819af73a29209babe6e includes iV[9748,12684),Qr[9012,9152),odt[12684,12896),xe[14123,14452). Complete zUt[7410,11760) andits pure resolver dependencies belong to chunk-n2jtmdcb.js SHA-256ac2918e2e92cdee84a05d0cefaa2cb0d37c787f9c27177698bc5d95d3fae2923. Local SendMessage named delivery[85447,88430) andcomplete deliver[61062,91506) belong to chunk-1fr2177j.js SHA-256426b0409ea13b070deeb49641fcc7775a3e6079c262f2fc314ddbb33b01c8da9. Child pin guard kjo[1205,2052) is chunk-0767hfs9.js SHA-25656f4a0f5682b8be4210eb695ce6b568601f658a04fc0e1f5eefd2c752aecb32c.

The original compiled --unified driver exits1 at the missing sessions section after text/held/approval/receipt controls pass. Pre-product identity260e3fd9 differs from W364 only in the driver. Implemented adapters retain existing UUID child IDs and journal structured JSON,replace StorageV5/appstate pins with a local typed journal event,disable source stable-address rollout and remote claim grouping,and keep own socket identity in the source ref collision set. Names and peer records remain untrusted data. Source schemas/byte caps and host JSON fields are explicit adapters. Exact pure row/candidate/resolver bodies stay copied. The current main capture has18module rows and126body rows,including duplicate SendMessage ranges. The final source supplement captures Ps/Ns and Ajo/xUr. The source normalizes names with NFKC and caps display names at200codepoints. Its single-line selector accepts at most300codepoints,including a printed ref. Host storage allows400UTF16units for the200codepoint display and leaves normalized journal keys unbounded by an invented display cap. The unified result keeps full typed data beside source-formatted listing andsections. No source account,subscription-backend,telemetry or entrypoint executes.

## Main verification

The expanded compiled driver first exposes an explicit child-ID defect. Complete zUt passes the raw ID as X's agentName,whereas the first adapter used its display name and collided with a previously pinned peer. A same-group assertion reproduces the failure. The adapter now keeps that source ID key. A second source-boundary assertion reproduces the200emoji selector rejection;Ps/Ns supplies the corrected Unicode predicate. Failed driver ID-correlation and cold-journal selection observers are preserved in question.md;product contracts and literal assertions remain.

Three behavior groups cover source name/ref/precedence,real registry and authenticated peer delivery,cold pin restoration,Unicode names and invalid selectors,legacy schemas,managed settings and release during discovery. The final affected run passes122/122 with0fail/cancel/skip. Typecheck and build pass. Actual compiled --unified passes32requester and3recipient model requests for combined roster,named peer,valid/bad ref,combined andpure idle subscription,explicit child continuation,rebound rejection,generated origin,cold history andclear/reload binding. The original peer driver passes4+1requests. Connected resident fork passes10model requests and18MCPRPC with cancellation,parent exit,relocation andcleanup. All model traffic is owned loopback SSE;real Magpie and paid upstream remain not_run.

Selected correspondence contains121complete UTF16 source/host pairs,112exact declarations. Every pair retains source andhost body text,digests,half-open ranges andbidirectional opcodes. The remaining nine pairs describe explicit host adapters;character matching does not assert their semantic equivalence. The post-repair candidate has1954records andidentity9cb02caa2b9fabf03a0307c45941cef69e48867aa523e55211f2c5840f4c5427. Full3436/3436across118suites passes with0fail/cancel/skip/todo,andall1954records remain unchanged afterward. Main proof41812c33 rechecks all1954records,130captured body rows,121pairs,112block regeneration,20evidence hashes,the three protected user files,17recorded exitedPIDs and0ownedfixture directories. Comment audit uses4leafcalls,verifies112source anchors andfinds one redundant explanation. Deleting that suffix retains its S7coordinate. Final check/build pass;two changed records(source/compiled comment) leave1952others unchanged andboth source/compiled executable syntax equal. Exact reversal proof3dd17434 binds delivery identityc00a1e3da9dca2f60bf07d299a99e068e55da456591c67e276398af0b817ce7f. Final121pairs are regenerated againstthosebytes. Fresh independent review returnsVERIFIED_SCOPED onthis frozen delivery with0findings at proof ea766d29,using26leafcalls againsta24target:all1954records andthree group digests match,121pairs/112exactcopy pairs pass,affected3/3tests andactualcompiled32+3requests exit0,and0owned resources remain. Its recorded limits are that the aggregate digest was not independently regenerated from its declared manifest encoding even though every underlying record matches,the peer rebind snapshot-to-send race was not exercised andso the source candidate stays candidate,andreal Magpie/daemon/StorageV5/remote owners stay outside scope. Final proof80e1040b rechecks the frozen identity,27evidence hashes,121/112 source pairs,17exited PIDs and0owned directories,and verifies26exact delivery paths.

## Reproduction commands

Run from the repository root. The smoke drivers supply owned loopback endpoints andprivate fixtures.

```sh
npm run check
npm run build
node --import tsx --test test/agent-messaging.test.ts
node scripts/smoke-peer-cli.mjs --compiled --unified
node scripts/smoke-peer-cli.mjs --compiled
node scripts/smoke-resident-fork-cli.mjs
npm test
```

Each listed final command exits0. The focused affected command additionally runs agent-registry,local-peer,local-peer-idle,runtime-resources,resident-fork,reload,cli-gateway,fork-relocation andsession-storage withtestconcurrency4and20000msper-testdeadline. `scripts/copy-source-plan.mjs` regenerates thefour source files andledger from thepersistentW365plan intoanowned empty directory;all fivefiles match byte-for-byte. Originalfailedcommands remain separate evidence andtheir exit1results are preserved.

## Boundaries and ownership

Runtime keeps live peer andSession getters under the existing owner scope. Discovery awaits are followed by signal andscope checks before any effect;release removes both bindings andretained tools stay invalid. Interactive startup,clear andaccepted reload bind the current transport without changing schema identity. Normal headless startup binds the Session anduses the same child tools without creating an inbox. Legacy absent/false feature catalogs retain the original factory.

Pin state is a host journal adapter. Complete source Ajo/xUr in0767hfs9[2476,3072) reconstructs child pins from successful structured tool results,and the conversation-swap owner in24k7d6mw resets pins. This host journals explicit validated pin facts in the current conversation andstarts successors with fresh state. It preserves its earlier durable-peer pin contract rather than claiming exact source storage or app-state lifetime. Clear/reload retain original journal facts andcreate a new pin owner. Peer status,receipts,UDS admission,pacing andidle lifetime remain with their previously verified owners.

S-1 throughS-7 review is recorded in coding-standard.md. The copy-first rule determines all112pure declarations. The smallest-boundary rule keeps existing registry/UDS effects andadds onlytyped selection/journal adapters. Actual-artifact verification uses thecompiledCLI andliteral effects;the full-suite result is bound toexact inputs/build. Deslop review finds no new handwritten any-cast,nocheck orscope-expanding fallback. The solecomment finding isfixed without changing executable code.

Full daemon/global lifecycle,StorageV5,remote/team discovery andsource result/UI parity remain outside this finite contract. The Agent messaging andsame-host families remainPartial. No source-equivalence percentage or real-model quality claim is made.
