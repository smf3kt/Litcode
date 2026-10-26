import { z } from 'zod';
import { previewSanitized, previewUnstableInput } from './preview-sanitize.js';

// amn/Aq, ax9zepsq [7009,8595), x2c03s1m [5272,11236), UTF-16.
export const planModeSchema = z.enum(['default', 'acceptEdits', 'auto', 'bypass']);
export type PlanExitMode = z.infer<typeof planModeSchema>;
export const planApprovalSchema = z.discriminatedUnion('behavior', [
  z.object({ behavior: z.literal('allow'), mode: planModeSchema, plan: z.string().optional(), feedback: z.string().optional() }).strict(),
  z.object({ behavior: z.literal('deny'), feedback: z.string().optional() }).strict(),
]);
export type PlanApproval = z.infer<typeof planApprovalSchema>;
export interface PlanReview {
  plan: string | null;
  filePath: string;
  automaticMode: Exclude<PlanExitMode, 'default'>;
}
export interface PlanModeHost {
  readonly filePath: string;
  readonly isAgent: boolean;
  mode(): string;
  automaticMode(): Exclude<PlanExitMode, 'default'>;
  enter(): void;
  exit(mode: PlanExitMode): void;
}
export const planHostResultSchema = z.object({
  kind: z.literal('plan'), operation: z.enum(['enter', 'exit']),
  plan: z.string().nullable(), isAgent: z.boolean(), filePath: z.string(),
  planWasEdited: z.boolean().optional(),
}).strict();
export type PlanHostResult = z.infer<typeof planHostResultSchema>;
export const modelPlanModeEventSchema = z.discriminatedUnion('operation', [
  z.object({ kind: z.literal('model_plan_mode'), operation: z.literal('enter'), mode: z.literal('plan'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('model_plan_mode'), operation: z.literal('exit'), mode: planModeSchema, planId: z.string().uuid() }).strict(),
]);
export type ModelPlanModeEvent = z.infer<typeof modelPlanModeEventSchema>;

// amn mapper, ax9zepsq [7009,8595), UTF-16; tool identifiers use the local catalog.
export const enteredPlanText = 'Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.\n\n' +
  'In plan mode, you should:\n1. Thoroughly explore the codebase to understand existing patterns\n' +
  '2. Identify similar features and architectural approaches\n3. Consider multiple approaches and their trade-offs\n' +
  '4. Use ask_user_question if you need to clarify the approach\n5. Design a concrete implementation strategy\n' +
  '6. When ready, use exit_plan_mode to present your plan for approval\n\n' +
  'Remember: DO NOT write or edit any implementation files yet. This is a read-only exploration and planning phase; only the designated plan file may be edited.';

// Got/jot/$ot, 24k7d6mw [1218850,1230824), UTF-16. Clear-context is a separate owner.
export function planReviewChoices(review: PlanReview): { label: string; value: string }[] {
  if (!review.plan?.trim()) return [{ label: 'Yes, manually approve edits', value: 'default' }, { label: 'No', value: 'deny' }];
  if (review.plan.length > 200000 || previewUnstableInput(review.plan)) return [];
  const label = review.automaticMode === 'bypass' ? 'Yes, and switch to bypass permissions for this session'
    : review.automaticMode === 'auto' ? 'Yes, and resume auto mode' : 'Yes, auto-accept edits';
  return [{ label, value: review.automaticMode }, { label: 'Yes, manually approve edits', value: 'default' }];
}
export function planPreview(plan: string | null): string {
  if (!plan?.trim()) return 'No plan found. Write the plan to the designated file before submitting a detailed plan.';
  return plan.length > 200000 || previewUnstableInput(plan)
    ? 'The plan exceeds the preview limit or contains text that cannot be displayed faithfully. Edit the plan file before approving.'
    : previewSanitized(plan);
}

// q/Aq result mapper, x2c03s1m [5582,11236), UTF-16. Team hints have no local owner.
export function approvedPlanText(plan: string | null, filePath: string, edited: boolean): string {
  if (!plan?.trim()) return 'User has approved exiting plan mode. You can now proceed.';
  return `User has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n` +
    `Your plan has been saved to: ${filePath}\nYou can refer back to it if needed during implementation.\n\n` +
    `## ${edited ? 'Approved Plan (edited by user)' : 'Approved Plan'}:\n${plan}`;
}

// Gqr/SDn/Uqr/xLn, sfn1dbxq [4441605,4453025), UTF-16. The owned file replaces the source slug.
export function planModeReminder(filePath: string, exists: boolean): string {
  const file = exists
    ? `A plan file already exists at ${filePath}. You can read it and make incremental edits using edit_file.`
    : `No plan file exists yet. You should create your plan at ${filePath} using write_file.`;
  return `Plan mode is active. The user indicated that they do not want you to execute yet -- you MUST NOT make any edits (with the exception of the plan file mentioned below), run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received.

## Plan File Info:
Plan file: ${JSON.stringify(filePath)}
${file}
You should build your plan incrementally by writing to or editing this file. NOTE that this is the only file you are allowed to edit - other than this you are only allowed to take READ-ONLY actions.

## Plan Workflow

### Phase 1: Initial Understanding
Goal: Gain a comprehensive understanding of the user's request by reading through code and asking them questions.

1. Focus on understanding the user's request and the code associated with their request. Actively search for existing functions, utilities, and patterns that can be reused -- avoid proposing new code when suitable implementations already exist.

2. Read and explore the relevant files directly to efficiently understand the codebase.

### Phase 2: Design
Goal: Design an implementation approach based on the user's intent and your exploration results from Phase 1.

- Provide comprehensive background context from Phase 1 exploration including filenames and code path traces
- Describe requirements and constraints
- Produce a detailed implementation plan

### Phase 3: Review
Goal: Review the plan(s) from Phase 2 and ensure alignment with the user's intentions.
1. Read the critical files you identified during exploration to deepen your understanding
2. Ensure that the plans align with the user's original request
3. Use ask_user_question to clarify any remaining questions with the user

### Phase 4: Final Plan
Goal: Write your final plan to the plan file (the only file you can edit).
- Begin with a **Context** section: explain why this change is being made -- the problem or need it addresses, what prompted it, and the intended outcome
- Include only your recommended approach, not all alternatives
- Ensure that the plan file is concise enough to scan quickly, but detailed enough to execute effectively
- Name the critical files to be modified. For changes that repeat a pattern across many files, describe the pattern once and list a few representative paths -- do not enumerate every file or line number
- Reference existing functions and utilities you found that should be reused, with their file paths
- Include a verification section describing how to test the changes end-to-end (run the code, use MCP tools, run tests)

### Phase 5: Call exit_plan_mode
At the very end of your turn, once you have asked the user questions and are happy with your final plan file - you should always call exit_plan_mode to indicate to the user that you are done planning.
This is critical - your turn should only end with either using the ask_user_question tool OR calling exit_plan_mode. Do not stop unless it's for these 2 reasons

**Important:** Use ask_user_question ONLY to clarify requirements or choose between approaches. Use exit_plan_mode to request plan approval. Do NOT ask about plan approval in any other way - no text questions, no ask_user_question. Phrases like "Is this plan okay?", "Should I proceed?", "How does this plan look?", "Any changes before we start?", or similar MUST use exit_plan_mode.

NOTE: At any point in time through this workflow you should feel free to ask the user questions or clarifications using the ask_user_question tool. Don't make large assumptions about user intent. The goal is to present a well researched plan to the user, and tie any loose ends before implementation begins.`;
}
