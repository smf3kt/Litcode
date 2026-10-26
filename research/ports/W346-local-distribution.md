# W346 local distribution closure

Status: verified locally with independent review,2026-10-26. Parent dd17ea8. Local only,no coauthor/no push.

## Task card

Entry/result: existing dependency notices check and offline package install accept the current local build.
Data: DependencyNotices.v1 records and original license texts;existing npm package file inventory.
Source: scripts/dependency-notices.mjs,scripts/smoke-package.mjs,package-lock.json and existing LICENSE/package metadata. No recovered product behavior changes.
Targets: generated THIRD_PARTY_NOTICES.txt and research/ports/dependency-notices.json;stale NOTICE.md,source-bundle license projection,offline install fixture and current distribution report.
Mode: regenerate through the existing generator;align prose with the already tracked MIT license. No dependency or lock change.
Validation: reproduce stale check,generate,check,offline package/install/help/demo and owned launcher/startup fixtures;bind source/build/notices/tarball identity and cleanup.
Completion: exact license text retained,package excludes analysis inputs,installed CLI works,independent bounded record/package review completes and local commit closes the loop.

## Preflight evidence

JOB_TMP=/Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

- npm run notices:check exits1 in w346-notices-baseline.txt. Existing notices match their recorded digest but the inventory lock digest is stale.
- Current lock SHA-25630774b93df9e8961820646ec4c665261c637a496538d0bbcb534807c9214476c has64dependency occurrences. All63old occurrences retain their versions;only fuse.js7.1.0 is added. Installed version matches. Its Apache-2.0 LICENSE contains11343bytes,SHA-256cc807e3caa26cdee316bab2ff6fdb508a2f619b74959fe59e513ef6e61635ebe.
- Existing generator reads local locked packages and retains exact license bytes in the notice text. It uses no network. No new generator or regression group is needed.
- npm pack --dry-run --ignore-scripts --json yields636files:626dist,threebin,twonative and fiveroot files. Research,samples,tests,source,private settings and scripts are absent.
- Existing LICENSE is MIT and package.json already declares MIT/private:true. NOTICE.md and the top FEATURES distribution paragraph still describe UNLICENSED and a70file package. Correct only that obsolete prose;publication stays outside this local closure.
- Prior full3380/3380 at W345 identityc6fea7e8 remains the code-validation baseline. This package changes no executable source or test.

## Throughput

Main runs the existing generator and single offline package driver in place. One fresh read-only reader receives the finished outputs and exact identity. No worktree,broad fanout,root dependency installation or paid upstream call. The package driver uses npm ci --offline in its owned temporary fixture and removes it after checks.

## Offline fixture repair

The first smoke builds/packs but exits1 at offline install. Its empty consumer project has no dependency lock,so ignore ^7.0.5 resolves cached registry metadata7.0.14 instead of the repository's7.0.5. The7.0.5tarball exists locally;7.0.14does not. Preserve w346-package.txt. Adapt only the owned package-install fixture to a consumer lock that adds the actual packed tarball at node_modules/litcode and reuses the repository's exact dependency records. npm ci --offline --ignore-scripts --omit=dev validates that graph. Check every installed nondev/nonoptional dependency version against its locked version. No product runtime,package constraint,root lock or shared npm cache changes. This binds the runtime package to the dependency graph used by its notices and build.

## Verification

- npm run notices and npm run notices:check exit0. Logs w346-notices-generate.txt and w346-notices-check.txt. All63prior inventory records match exactly;the64th is fuse.js7.1.0 with exact Apache text. There are39installed records,25optional-not-installed and five installed packages with no root license text. Those five remain explicitly disclosed by identifier/repository;no new license-gap claim is hidden.
- Actual npm run smoke:package after the fixture repair exits0 in w346-package-locked.txt. It builds,creates636file tarball,installs with npm ci --offline --ignore-scripts --omit=dev,checks28exact production dependency versions and runs installed help,legacy alias,demo,launcher help and owned launcher/startup fixtures. TSX and extracted/research/private inputs are absent. External model requests0. Optional TUI flag suites are not rerun.
- The tested tarball SHA-256 is29bc53a38b314d78bf71b7262f5ac69c88021b3e7efc1672c6e8d18eea35a60c. The driver's private package and install directories are removed after checks. It is a local acceptance artifact,not a published release.
- Source-bundle licensing consumer also retained a literal UNLICENSED value and omitted LICENSE. Add the tracked LICENSE to its allowlist and read projectLicense from existing package metadata. Actual generation into JOB_TMP/w346-source-bundle copies1235files. All1235path/bytes/digests match both original and generated files;LICENSE is included and projectLicense is MIT. Source manifest aggregate3937ce69d34ddb1f1cd4d417c7726dc01da5794c8c95afa157c9beeb55583cdd. No source-bundle rebuild is claimed.
- node --check passes for both modified scripts. git diff --check passes. An ancestry-aware scan has0ownedprocesses. Directories created since the first W346 package attempt remaining0. Three older fixture directories are identified by birthtimes2026-10-19/25 and preserved.
- Product source,test files and all626dist records equal the W345 full3380/3380 baseline. No additional full-suite run is needed for this script/prose/generated-text package.

## Identity and independent review

Final shared1856record identity6ac386d0a78d255ecff4261b789bd20bdaa4b4c472d8a6d3f07cd82aa9aeba76 in w346-final-identity.json. Inputs886aggregate82cd5fcf304733743df3a68c4b9493ff7b9a962cd4737d098e67d7becdda8128;validation344aggregate8e394a180fa86424cb83a187f4a6c999fba15afdb495ad0cdfd788dd3545b74a;build626aggregatec560259a32cf3e2614cb6df91ea9a836301dace7666b48f2fe1b7cdd61178e18. Only scripts/smoke-package.mjs and scripts/source-bundle.mjs differ from W345 within that identity. The earlier package-run identityeb919a81 predates only the source-bundle script update;the runtime package excludes both scripts.

Notices SHA-2560f394befde36fbc0b922d1a73f0f5d69e0e793007c364fc3cdbfe645ae71972b;inventory SHA-256b8633620970e3964a0601d35cde1c528e2bc6410444b7542e858b415f1473fc2;NOTICE.md SHA-256bd05fd3be82e67628e91d04d65f0bc0545fc37fae992af2f32bd9ab65945d1a6;LICENSE SHA-2562cb6c18867ed9492fa1c3ddbf10556af7d65b5e2ded4b7c2371e33f3633103f7. Root package and lock bytes stay unchanged.

A fresh bounded read-only reviewer reports0confirmed scoped defects against dd17ea8. Independent npm run notices:check and npm run smoke:package both exit0,including the driver's own rebuild,636file tarball,28exact production versions,installed CLI/help/demo and owned launcher/startup checks. The independent tarball SHA-256 equals main's29bc53a38b314d78bf71b7262f5ac69c88021b3e7efc1672c6e8d18eea35a60c. All original package assertions remain and the actual consumer lock retains64exact dependency records with the tarball's verified integrity. All63old notice records and exact11343byte Fuse license match. All1235source-bundle records match original/copied bytes,digests and modes;MIT and exclusions hold.

Independent before/after captures match all1856records at6ac386d0. Product source,test and626build records match the main-owned W345 full3380/3380 baseline. The reviewer does not rerun full tests. Protected dirty files and initial ENOTCACHED history remain unchanged. Of52observed owned processes and five fixture directories,none remain. Observer ancestry is excluded,three older directories are preserved,and the review's private cache is removed. Shared cache access is read-only. Evidence is JOB_TMP/w346-independent-result.json,w346-independent-review.mjs,w346-independent-notices.txt,w346-independent-package.txt and before/after identity files. Nine tool calls,0repository edits.

Known local closure is complete. Cron08b073ae is cancelled after acceptance. No further work package or publication is started.

## Coding-standard check

S-1 reproduces stale notices and actual offline-cache failure before changes. S-2 keeps all original package assertions and offline mode,adding exact installed versions. S-3 is not applicable. S-4 uses existing private install/fixture cleanup and preserves older directories. S-5 binds lock,license,tarball and every copied source record. S-6 aligns notices,NOTICE,current distribution report and source-bundle license projection. S-7 reads the existing owned generators/drivers and recorded license before editing;recovered product behavior is unchanged. No new rule or suppression.
