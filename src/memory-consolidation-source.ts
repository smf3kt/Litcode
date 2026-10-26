// @ts-nocheck
// chunk-kxgzv2t8.js le,de [1969,4291), UTF-16; sha256 9a5c68ddc00cf42fb4bd9f4fe30cb128f48eeeaa6d74582640b5b6056fca821c
var le="## Team memory (`team/` subdirectory)\n\nThe `team/` subdirectory holds memories shared across everyone working in this repo. Other teammates' Claude sessions write here too \u2014 treat it differently from your personal files:\n\n- **Phase 1:** `ls team/` and skim it alongside your personal files. A teammate may have already captured something you'd otherwise duplicate.\n- **Phase 3:** Merge near-duplicates *within* `team/` the same way you would personal memories. If a personal memory restates a team memory, delete the personal one.\n- **Phase 4 \u2014 be conservative pruning `team/`:**\n  - DO delete or fix a team memory that is clearly contradicted by the current code, or that a newer team memory marks as superseded.\n  - DO NOT delete a team memory just because you don't recognize it or it isn't relevant to *your* recent sessions \u2014 a teammate may rely on it.\n  - When unsure, leave it. A stale team memory costs little; deleting a teammate's load-bearing note costs a lot.\n\nDo not promote personal memories into `team/` during a dream \u2014 that's a deliberate choice the user makes via `/remember`, not something to do reflexively.",de=`### Reconcile memories against CLAUDE.md

Project CLAUDE.md instructions are loaded in your system prompt. For each memory that captures feedback or project conventions (the \`feedback\`/\`project\` types, where tagged), check whether it contradicts a CLAUDE.md instruction on the same topic:

- **Memory is stale** \u2014 CLAUDE.md and the memory describe different procedures for the same task: CLAUDE.md is the maintained, checked-in source. Delete the memory, or rewrite it to agree if it carries context worth keeping (the *why* is still useful but the *how* is wrong).
- **CLAUDE.md may be stale** \u2014 the memory is clearly dated after CLAUDE.md and explicitly corrects it: do NOT edit CLAUDE.md during a dream. Annotate the memory with "contradicts CLAUDE.md \u2014 verify which is current" and list it in your summary so the user can update CLAUDE.md.
- **Not a conflict** \u2014 the memory adds detail CLAUDE.md doesn't cover, or narrows a CLAUDE.md rule with a stated reason. Leave it.

A \`feedback\` memory's "Why: the user corrected me" framing is not evidence it's newer than CLAUDE.md \u2014 CLAUDE.md may have been updated since.`;
// chunk-btcaa7nx.js Iu,dN,Moe,Iwr,cRe,Doe [805,868), UTF-16; sha256 118198bef520b6b233a83a4297b3fdbebcae73d33eeb73d5c204de0c99bf795b
var Iu="MEMORY.md",dN=200,Moe=25000,Iwr=4*Moe,cRe=200,Doe=4096;
// chunk-btcaa7nx.js MFe,Owr [1150,1421), UTF-16; sha256 375eff0a8b497e6c86b10f77fd684a76427a8aee33bcc5b6072c7857accb3808
var MFe="This directory already exists \u2014 write to it directly with the Write tool (do not run mkdir or check for its existence).",Owr="Both directories already exist \u2014 write to them directly with the Write tool (do not run mkdir or check for their existence).";
// chunk-nannv282.js wS [619,635), UTF-16; sha256 733779b2f6a6dc938b49f0e4c61452c3e91987932832026d14f7aa4ee3226d3b
var wS="memory_list";
// chunk-nannv282.js Pm [636,652), UTF-16; sha256 11fabb515284c11c6ecc3127fe27ace807007f53b29f2ea5751869735cf47122
var Pm="memory_read";
// chunk-nannv282.js yd [653,670), UTF-16; sha256 bbe90875c5803391eddc6578ede9529ca2366ec78aa1f8dc2442a88dca16954b
var yd="memory_write";
// chunk-kxgzv2t8.js Q [4291,7234), UTF-16; sha256 4547b1e2614968101d6d33cac14a3c4081367d03b6b937b48fdd4da9f02a2947
function Q(e,r,o,y=!1,p=!1,s=!1){return`# Dream: Memory Consolidation

You are performing a dream \u2014 a reflective pass over your memory files. Synthesize what you've learned recently into durable, well-organized memories so that future sessions can orient quickly.

Memory directory: \`${e}\`
${MFe}

Session transcripts: \`${r}\` (large JSONL files \u2014 grep narrowly, don't read whole files)
${y?`
${le}
`:""}
---

## Phase 1 \u2014 Orient

- \`ls\` the memory directory to see what already exists
- Read \`${Iu}\` to understand the current index
- Skim existing topic files so you improve them rather than creating duplicates
- If a \`sessions/\` subdirectory exists, review recent entries there

## Phase 2 \u2014 Gather recent signal

Look for new information worth persisting. Sources in rough priority order:

1. **Existing memories that drifted** \u2014 facts that contradict something you see in the codebase now
2. **Transcript search** \u2014 if you need specific context (e.g., "what was the error message from yesterday's build failure?"), grep the JSONL transcripts for narrow terms:
   \`grep -rn "<narrow term>" ${r}/ --include="*.jsonl" | tail -50\`

Don't exhaustively read transcripts. Look only for things you already suspect matter.

## Phase 3 \u2014 Consolidate

For each thing worth remembering, write or update a memory file at the top level of the memory directory. Use the memory file format and type conventions from your system prompt's auto-memory section \u2014 it's the source of truth for what to save, how to structure it, and what NOT to save.${p?` The ${wS} / ${Pm} / ${yd} tools are unavailable in a dream: consolidate only this memory directory, and leave anything that section marks as shared with the project where it is \u2014 never copy it into these files.`:""}${""}

Focus on:
- Merging new signal into existing topic files rather than creating near-duplicates
- Converting relative dates ("yesterday", "last week") to absolute dates so they remain interpretable after time passes
- Deleting contradicted facts \u2014 if today's investigation disproves an old memory, fix it at the source

## Phase 4 \u2014 Prune and index

Update \`${Iu}\` so it stays under ${dN} lines AND under ~25KB. It's an **index**, not a dump \u2014 each entry should be one line under ~150 characters: \`- [Title](file.md) \u2014 one-line hook\`. Never write memory content directly into it.

- Remove pointers to memories that are now stale, wrong, or superseded
- Demote verbose entries: if an index line is over ~200 chars, it's carrying content that belongs in the topic file \u2014 shorten the line, move the detail
- Add pointers to newly important memories
- Resolve contradictions \u2014 if two files disagree, fix the wrong one

${de}

---

Return a brief summary of what you consolidated, updated, or pruned. If nothing changed (memories are already tight), say so.${o?`

## Additional context

${o}`:""}`}

export function sourceConsolidationPrompt(memoryDirectory: string, transcriptDirectory: string, context: string): string {
  return Q(memoryDirectory, transcriptDirectory, context, false, false, false);
}

export function sourceConsolidationThresholds(options: { minHours?: number; minSessions?: number } = {}): { minHours: number; minSessions: number } {
  const k = () => options;
  const se = { minHours: 24, minSessions: 5 };
// chunk-kxgzv2t8.js fe [8435,8719), UTF-16; sha256 ff9f498c03e616384d8be51cf99e50245461bc7c6698c8981e1c645c83dc0723
function fe(){let e=k("tengu_onyx_plover",null);return{minHours:typeof e?.minHours==="number"&&Number.isFinite(e.minHours)&&e.minHours>0?e.minHours:se.minHours,minSessions:typeof e?.minSessions==="number"&&Number.isFinite(e.minSessions)&&e.minSessions>0?e.minSessions:se.minSessions}}
  return fe();
}
