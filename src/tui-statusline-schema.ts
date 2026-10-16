// @ts-nocheck
// Exact source schema arrow; provenance: research/ports/W44-statusline-copies.json.
import {z} from 'zod';
const u=z.object,C=z.literal,o=z.string,v=z.number,H=z.boolean;
export const statusLineSchema=(()=>u({type:C("command"),command:o(),padding:v().optional(),refreshInterval:v().min(1).optional().catch(void 0).describe("Re-run the status line command every N seconds in addition to event-driven updates"),hideVimModeIndicator:H().optional().describe("Hide the built-in `-- INSERT --` / `-- VISUAL --` indicator below the prompt. Use this when your status line script renders `vim.mode` itself.")}).optional().describe("Custom status line display configuration"))();
