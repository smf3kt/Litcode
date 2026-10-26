# W359 local peer acceptance

Status: verified locally with fresh independent VERIFIED_SCOPED, 2026-10-27. Main final identity/source/evidence/resource checks pass. Base2c36f19dd2abdafcadc718586a5acf264a22ff7a. JOB_TMP is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

## Task card

- Outcome: current compiled CLI sessions discover each other, send exact text, hold mismatched input, approve/deny/expire it, report receipts and release owned socket/key/record/journal resources.
- Source: complete W186 local UDS discovery, sender, inbox, policy/held and cleanup bodies; W349 resident extension retains its own contract.
- Targets: src/local-peer.ts, src/runtime.ts, two existing regression files and scripts/smoke-peer-cli.mjs.
- Contract: local UDS and AgentRegistry child messages retain distinct APIs. Peer text stays data with peer/uds origin and skips slash dispatch. The inbox reads current policy while tools retain their allocated owner identity.
- Method: port the two reproduced source-owned defects in their existing owners; extend the existing owned compiled driver. No new product flag, schema or account transport.
- Checks: two new regression groups, affected checks, types/build, compiled two-process chain, resident compatibility, full-suite milestone, source correspondence and one fresh independent verifier.
- Constraints: one active package, in place, exact local commits, original three dirty files preserved, source samples inert/read-only, no credentials/accounts/cloud/paid calls/coauthor/push/new schedule.

## Source identity and complete bodies

Sample2.1.296 SHA256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Ranges below are zero-based half-open UTF16 code units. UTF8 bytes are counted separately. Acorn captures validate each complete declaration against extracted-v2/manifest.json decodedSha256. No recovered application entrypoint runs.

| Module | SHA256 | Complete captured symbols and ranges |
| --- | --- | --- |
| chunk-6zdc3jq1.js | 8009c180a36973dc5853feebabd9653728bb5a902f3f27aa36cd883187ca3e9a | K8t[12210,13125),we[15535,17953),q[17953,18154),F[18299,18568),G[18568,20657),Z[21883,22142),Sao[22142,22608),ee[23041,23100) |
| chunk-m7864yc0.js | 190465da91f131a8ccd7708ae318757359ebe9f53bc32819af73a29209babe6e | oV[4852,4892),STs[5232,5505),bTs[6473,6592),wTs[6592,7933) |
| chunk-3sda67c1.js | 285259b1c6dcf821a48f703d5fb866a9f69e9b52f19a235a9ae68f7dd7384cef | Iue[2547,2601),Nm[2601,2700),Ibe[4694,4739),Fy[5366,5435),hD[5435,5525),qQ[5525,5617),C[5621,5628),F[5629,5635),Ul[5636,5899),P[6054,6368) |
| chunk-0ydceggj.js | ca1c4ce2ce4d84bd24cca5d1a2f7f8eb2e732d046edd178b8d8f4facf50db341 | hht[1292,1350),yht[2299,2365),ZUt[2525,2968),n1r[2968,3056),e1t[3056,3105),t1t[3105,3155),Z7e[3155,3187),I[3187,3691),h[3786,3954),S[4409,4462),_[4462,4491),E[4491,4991),cOe[5137,5170),r1r[5170,5205),v[5205,5483),R[6012,7011),bht[7805,7881),M[8396,8537),A[8537,9603),wht[9603,10599) |
| chunk-bt8cr7rw.js | 5fa6b57b2b362f4047324577cee8ca6263304332d36ea8389f2cf911f2213667 | Ie[4958,5180),Qe[5180,6744),Je[11877,12278),nn[12376,14664),j[15004,15363),Y[15363,15599),mn[28327,34716) |
| chunk-akfkn8xh.js | dcae213f12d26a84eface39176fff4ed4a0cb63f83e6a3f32336dd6ca0ad36d0 | GTs[1155,1624) |
| chunk-w9kaj2q7.js | c9f40c6995b02e693505c0f8c86273286f00a7b85187d878cb69e8f21d5d380e | ajr[1484,2566) |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | Rwt[472253,472852) |

Captures are JOB_TMP/w359-{discovery,inbox,process,process-deps,policy,policy-owner,policy-setter}-source.json. The last capture contains held callback registrations and policy readers, not an invented settings setter. Vi is import-bound and remains explicitly unresolved in the policy-owner capture; its whole global registry is outside this port. Existing native peer credentials remain the W186 bridge, not a new runtime reconstruction.

## Source-owned repairs

1. wTs ranks only live processes with !Nm(pid), then exact matching birth=2, missing/unknown birth=1, dead/recycled=0. Nm returns true only for ESRCH after the source PID bounds. The host had lost the negation. Actual compiled authenticated resident delivery selects the stale candidate and makes0modelrequests; removing only that candidate gives1request. The repaired existing readKey uses !processGone and delivers1request with the stale candidate retained, then1controlrequest after removal. Tests cover stale order, recycled birth and no live owner. Tokens are compared only in memory; evidence stores booleans/PIDs.
2. I/Z7e/E/v read inbound policy and permission mode at receipt/release time. Existing interactiveLoop peerExplicit already reads session.config by reference. The first extended compiled chain exercises approve/deny/expire/refuse, then fails the next released message after /peer-inbound with Runtime owner configuration changed. The host tool fingerprint had included this live inbox field. Excluding only crossSessionInbound preserves the tool objects and the allocated resource owner; the new owner regression also changes maxOutputBytes and requires the original guard to fail. No resource rebuild or general guard relaxation.

W186 Node socket/native identity/filesystem adapters remain. W189 documents the existing tool-owner fingerprint contract. Two stale historical source-coordinate comments are corrected from complete declarations. The comment reader reports one stale two-line socket path explanation; main deletes it, retaining the mandatory S7 anchor. No added suppression or unsafe cast. Main precommit deslop inspection of the five scoped diffs finds no further actionable redundancy,guard,cast or nesting issue;no frozen product edit follows it.

## Finite acceptance and retained differences

The extended --compiled --acceptance driver runs two real CLI processes in distinct workspaces with a private shared registry and owned loopback SSE. The model calls list_peers/send_peer_message/peer_message_status. Initial mode mismatch holds exact text; approve delivers it and the sender reads delivered. Deny/explicit expiry/refuse produce terminal receipts and no recipient model turn. Policy changes to hold; literal /exit is approved as exact model input, stored with classifier.origin={kind:'peer',source:'uds'}, and leaves the recipient alive. A final held message expires on recipient exit. Model discovery then returns no peers. Both exits are0; owned PIDs are ESRCH; no journal lock, socket, record or key remains. Expanded30requests=A28+B2. Original driver5requests=A4+B1.

The existing resident chain also passes10modelrequests/18localMCPRPC, bare no replay, one file effect, parent exit, origin relocation, cancellation and owned cleanup. These are owned fixtures, with0external calls. They do not establish real Magpie deployment.

The family remains Partial. Complete source K8t includes send pacing, plugin formatting and local file attachments. Qe includes attachment materialization, ingress-loop handling and session.receive queueing. The current narrow APIs carry exact text and use the host classifier, without the complete source owner. Source mn maps refused to expired+status_detail and restricts reply namespaces; this host exposes refused directly and currently uses its existing endpoint checks. Source ZUt awaits receipt callback promises, whereas the current void callback starts sends without exposing completion to expireAll; current successful exit receipt is finite evidence, not proof of that delayed-send contract. Full global inbound state, StorageV5, sender pacing, namespace/wire correspondence, notify-idle surfaces and daemon/rawPTY remain separate source-first follow-ups. Cloud/bridge/DID and account work stays excluded under the user's local-only instruction. No family promotion is inferred from passing the finite chain.

## Source/host correspondence and frozen identity

JOB_TMP/w359-source-host-character-diff.json contains29complete AST-selected source/host pairs, UTF16-contiguous diff opcodes and both exact reconstruction directions. SHA25619228f7092ab264a8a63f13873b758ab59f17707c0408521f643a67c238d60c6,247018UTF8bytes. It binds source module digests, complete host ranges, each adaptation reason and the retained limits above. JOB_TMP/w359-source-diff.mjs regenerates into an absent output path. A text diff is correspondence, not behavioral equivalence.

JOB_TMP/w359-final-identity.json freezes1911records at73677e60d68dcab5945ea6f2f83400dc9f5374e66ea8b02e010039918f495b22.

| Group | Records | SHA256 |
| --- | --- | --- |
| inputs | 913 | 8af20020c5b71c3fa32c1b8b75bd47291885573494e70ababf17f01bf51dcd68 |
| validation | 355 | b22f6fc603e5e430aef0521f143babe1667876794215378c5dd81bdce214d309 |
| build | 643 | 93bbddd13f32b4fd6b9e8b713bd8809224a93785a7ab5124d73ff34c79da8ca1 |

JOB_TMP/w359-scope-proof.json compares every record against W358a26d2581: exactly3inputs,2tests and2compiledJS change;all other1904records match. JOB_TMP/w359-evidence-manifest.json binds27main evidence files at97d7f5189c34e196444ddeb9769cbb2a5fc1e57da3701e185395ff1599b2ea4b. Independent evidence and final main checks receive their own records after the reviewer finishes.

## Validation and failed observations

- Existing compiled baseline exit0,4sender+1recipient requests, w359-baseline-cli.txt.
- Source-ranking controlled red exit0 with selectedLive=false,staleRequests=0,controlRequests=1, w359-key-controlled-baseline-proof.json. No auth rejection log was exposed; invalidAuthObserved=false is retained.
- New ranking regression initially fails. w359-ranking-red.txt redacts four owned fixture token values while preserving originalSHA58b3a9e7cc3b1b5f1c0eedf84742b2fca089be11f6c96bb951b9b4615415e8d9 in w359-ranking-red-redaction.json. Assertions now expose boolean comparison only. Repaired local-peer16/16passes.
- Repaired compiled resident key proof selectedLive=true,staleRequests=1,controlRequests=1,externalCalls=0, w359-key-repaired-proof.json.
- Expanded first actual CLI fails at the live-policy owner guard, w359-cli-first.txt. The first new unit fixture had not allocated an owner and is not product red; backgroundWorkCount allocates it before the final green/pinned-negative assertions, w359-policy-green2.txt.
- Driver iteration2 expects a nonexistent top-level isMeta field. The actual host uses classifier.origin. Only the new assertion is corrected after reading its owner; literal text/process-alive checks remain. w359-cli2.txt retains the mismatch; w359-cli3.txt passes30requests.
- Affected four files70/70pass, w359-affected-final.txt. Final npm run check and npm run build exit0, w359-check-final.txt/w359-build-final.txt.
- Legacy compiled peer5requests pass, w359-cli-legacy.txt. Resident compatibility10model/18MCPRPC pass, w359-resident-compat.txt.
- Frozen full-suite milestone exit0,3418/3418tests in118suites,0fail/cancel/skip/todo, w359-full.txt. LogSHA4ded869163a8a279d3f0715ddaa6679b107503868bb3184faa0aaf02bcf2056e. w359-full-proof.json confirms all1911records unchanged at73677e60. Fresh independent VERIFIED_SCOPED verifies both regression groups,actualcompiled30requests,all1911records before/after/closure,29completepairs and52capturedsourcebodies. It confirms comment-only reversal has identical executable syntax,all3protectedhashes match,CLI exits0/ESRCH andpre-deletion locks/sockets/records/keys are empty. Final ownedresources0. Machine verdict w359-independent-reader-20261027a-final-verdict.json SHA2e00bf1b7f83b53bf85c17ae4261774e842a8c83ae2a6bd1a54de0915ba2fbe8,24leafcalls. Its initial INCONCLUSIVE records a verifier-owned tsx cache;after regular-file inventory,no-open-file andESRCH checks,247ownedcachefiles are removed andclosure passes. Initial verdict19ebb737bf599139dae4bfc609918b970030f36416a6e9acdb1d4bbf55214b64 remains retained. Main w359-main-final-verification.json separately rechecks all29pairs,all1911identityrecords,27main evidence hashes,independentloghashes,protectedhashes and0resources.

Mechanical scratch failures are retained in w359-key-baseline{,2,3}.txt: nonexistent export path, incomplete createRuntime arguments and mutually exclusive resume flags. They fail before the intended predicate and provide no product verdict. Four verified-empty owned fixture directories from the second failure are removed after checking process/open-file ownership. A duplicate-await narrowing compiler error is repaired by one named KeyLookup value. research/question.md records these incidents. Main's final evidence verifier initially compares the independent identity wrapper as if it were the raw shared manifest;the wrapper actually contains a flat group-tagged records array. Read its real shape andcompare all1911group-tagged records plus identity. That scratch-only correction passes without changing product or independent evidence. The first failed assertion and a subsequent overbroad key-list diagnostic produce oversized output;later verification stays redirected/bounded.

## Remaining-owner preflight

While W359 stays frozen, read-only follow-up captures w359-followup-source.json andw359-followup-core-source.json locate complete q8t[8132,8337)/ie[8337,9249)/je[11823,11874) in6zdc3jq1 andD[5727,6012) in0ydceggj. They expose a source token bucket andthe enqueueReportingAdmission boundary;no behavior is added in this package. Import-bound Vi is resolved to chunk-pn2pjtqa.js SHAa42b8dfde5f5de1b7a516aeb055a59bee37250551fc044d15265e6582a4334ae [3159,3195),whose host-scoped registry still needs its complete class. TQr in sfn1dbxq[238970,239018) delegates to the owned queue. The original capture's unresolved marker is retained as historical acquisition scope,not a claim that the body is unobtainable. The next local package must complete those dependencies before implementation.

## Coding standard and resource boundary

S-1 complete manifest-bound bodies and actual compiled distinguishing controls precede each product repair. S-2 actual pinned-setting guard and previous assertions remain. S-3 raw peer text is unchanged. S-4 inbox, sender, child and journal owners are checked after exit. S-5 the driver waits for completed turns and observes terminal receipts. S-6 live policy and tool-owner consumers are checked together. S-7 copy the recovered live predicate and adapt only the existing live-field fingerprint. No extra implementation framework.

Protected preexisting dirty hashes remain the W358 set: .audit/w332-runtime.tsv3231dfe89f4b63c65869b4df1efa2967475ee3c222a8fc24a81c3ee281456228; .audit/w45-77-evidence.mjs9a3b57af640773f1283975e6ca49523407d8fb8469639817da5ab807b7b4d3aa; test/skills-command.test.ts995b1526bc74ab0d9f278bd61442c4254e3194e6528d12d18de75b5184404735. They stay outside this package's staging list. No credential store is read. No dist output is committed.
