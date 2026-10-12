/**
 * Credential shapes recognized in text the harness passes on to the model.
 *
 * The known-secret path only removes strings this session was configured with,
 * so a provider token that arrives in text from anywhere else goes through
 * untouched. These are the provider formats a token can be recognized by
 * without knowing it in advance: each entry is a prefix or format that a
 * provider itself publishes, so a match is a credential rather than a guess.
 *
 * Only the precise half of the recovered table is carried. The recovered set
 * also holds twelve low-confidence entries - URL userinfo, an authorization
 * header value, a loose JWT, an assignment to a field named like a secret, a
 * loose Anthropic prefix - and those are deliberately absent: this table runs
 * on a surface that drops a citation whose URL changes under it, so a pattern
 * that matches an ordinary user:password URL or the word before an equals sign
 * would silently discard legitimate results. See the port record for the list.
 *
 * The replacement token is the one this runtime already uses on the same
 * surface, so a string can carry known-secret and shape redactions together
 * without two spellings of the same marker.
 */

export type CredentialShape = {
  /** The provider family the pattern belongs to. */
  id: string;
  /** The regex source, as the recovered table spells it. */
  source: string;
  /** Regex flags, when the recovered entry has any. */
  flags?: string;
};

export const CREDENTIAL_SHAPES: readonly CredentialShape[] = [
  { id: "aws-access-token", source: "\\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\\b" },
  { id: "gcp-api-key", source: "\\b(AIza[\\w-]{35})(?![\\w-])" },
  { id: "google-oauth-client-secret", source: "\\bGOCSPX-[\\w-]{28}(?![\\w-])" },
  { id: "azure-ad-client-secret", source: "(?:^|[\\\\'\"\\x60\\s>=:(,)])([a-zA-Z0-9_~.]{3}\\dQ~[a-zA-Z0-9_~.-]{31,34})(?:$|[\\\\'\"\\x60\\s<),])" },
  { id: "digitalocean-pat", source: "\\b(dop_v1_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "digitalocean-access-token", source: "\\b(doo_v1_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "anthropic-api-key", source: "\\b(sk-ant-api03-[a-zA-Z0-9_\\-]{93}AA)(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "anthropic-admin-api-key", source: "\\b(sk-ant-admin01-[a-zA-Z0-9_\\-]{93}AA)(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "anthropic-oauth-token", source: "\\b(sk-ant-(?:oat|ort)\\d{2}-[\\w-]{20,})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "openai-api-key", source: "sk-[A-Za-z0-9_-]{8,200}T3BlbkFJ[A-Za-z0-9_-]{8,200}" },
  { id: "openai-legacy-api-key", source: "\\bsk-[a-zA-Z0-9]{48}(?![a-zA-Z0-9])" },
  { id: "huggingface-access-token", source: "\\b(hf_[a-zA-Z]{34})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "supabase-secret-key", source: "\\bsb_secret_[A-Za-z0-9_-]{20,}" },
  { id: "supabase-access-token", source: "\\bsbp_[a-z0-9]{40,}" },
  { id: "github-pat", source: "ghp_[0-9a-zA-Z]{36}" },
  { id: "github-fine-grained-pat", source: "github_pat_\\w{82}" },
  { id: "github-app-token", source: "(?:ghu|ghs)_[0-9a-zA-Z]{36}" },
  { id: "github-oauth", source: "gho_[0-9a-zA-Z]{36}" },
  { id: "github-refresh-token", source: "ghr_[0-9a-zA-Z]{36}" },
  { id: "gitlab-pat", source: "glpat-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-deploy-token", source: "gldt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-runner-authentication-token", source: "glrt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-oauth-app-secret", source: "gloas-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-pipeline-trigger-token", source: "glptt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-kubernetes-agent-token", source: "glagent-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-incoming-mail-token", source: "glimt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-scim-oauth-token", source: "glsoat-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-ci-build-token", source: "glcbt-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-feed-token", source: "glft-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "gitlab-feature-flag-client-token", source: "glffct-[\\w=-]{20,}(?:\\.[0-9a-z]{9})?" },
  { id: "slack-bot-token", source: "xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*" },
  { id: "slack-user-token", source: "xox[a-z](?:-[0-9]{10,13}){3}-[a-zA-Z0-9-]{28,34}" },
  { id: "slack-rotation-token", source: "xoxe(?:\\.xox[a-z])?-[0-9]-[A-Za-z0-9-]{28,}" },
  { id: "slack-app-token", source: "xapp-\\d-[A-Z0-9]+-\\d+-[a-z0-9]+", flags: "i" },
  { id: "slack-workflow-token", source: "\\bxwfp-[a-zA-Z0-9-]{20,}" },
  { id: "slack-webhook-url", source: "(?:https?://)?hooks\\.slack\\.com/(?:services|workflows|triggers)/[A-Za-z0-9+/_-]{40,}", flags: "i" },
  { id: "twilio-api-key", source: "SK[0-9a-fA-F]{32}" },
  { id: "sendgrid-api-token", source: "\\b(SG\\.[a-zA-Z0-9=_\\-.]{66})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "npm-access-token", source: "\\b(npm_[a-zA-Z0-9]{36})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "pypi-upload-token", source: "pypi-AgEIcHlwaS5vcmc[\\w-]{50,1000}" },
  { id: "databricks-api-token", source: "\\b(dapi[a-f0-9]{32}(?:-\\d)?)(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "hashicorp-tf-api-token", source: "[a-zA-Z0-9]{14}\\.atlasv1\\.[a-zA-Z0-9\\-_=]{60,70}" },
  { id: "pulumi-api-token", source: "\\b(pul-[a-f0-9]{40})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "postman-api-token", source: "\\b(PMAK-[a-fA-F0-9]{24}-[a-fA-F0-9]{34})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "grafana-api-key", source: "\\b(eyJrIjoi[A-Za-z0-9+/]{70,400}={0,3})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "grafana-cloud-api-token", source: "\\b(glc_[A-Za-z0-9+/]{32,400}={0,3})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "grafana-service-account-token", source: "\\b(glsa_[A-Za-z0-9]{32}_[A-Fa-f0-9]{8})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "sentry-user-token", source: "\\b(sntryu_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "sentry-org-token", source: "\\bsntrys_eyJpYXQiO[a-zA-Z0-9+/]{10,200}(?:LCJyZWdpb25fdXJs|InJlZ2lvbl91cmwi|cmVnaW9uX3VybCI6)[a-zA-Z0-9+/]{10,200}={0,2}_[a-zA-Z0-9+/]{43}" },
  { id: "stripe-access-token", source: "\\b((?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99})(?:[\\x60'\"\\s;]|\\\\[nr]|$)" },
  { id: "shopify-access-token", source: "shpat_[a-fA-F0-9]{32}" },
  { id: "shopify-shared-secret", source: "shpss_[a-fA-F0-9]{32}" },
];

/** The token this runtime substitutes; the same spelling the known-secret path uses. */
export const CREDENTIAL_REDACTION = "[redacted]";

let compiled: readonly { id: string; re: RegExp }[] | null = null;

function patterns(): readonly { id: string; re: RegExp }[] {
  if (compiled === null) {
    compiled = CREDENTIAL_SHAPES.map(({ id, source, flags }) => ({
      id,
      // The recovered table strips a caller's `g` and re-adds it, because a
      // table entry may be compiled once and used in a loop.
      re: new RegExp(source, `${(flags ?? "").replace("g", "")}g`),
    }));
  }
  return compiled;
}

/**
 * The shape ids whose pattern matches this text, in table order. Used by the
 * tests and by an operator asking which rule fired; redaction itself does not
 * need the ids.
 */
export function credentialShapeIds(text: string): string[] {
  const found: string[] = [];
  for (const { id, re } of patterns()) {
    re.lastIndex = 0;
    if (re.test(text)) found.push(id);
  }
  return found;
}

/**
 * Replace every recognized credential span with the redaction token.
 *
 * Where a pattern captures the token inside surrounding context - a quote, a
 * space, `\\n` in an escaped string - only the captured span is replaced, so
 * the text around it survives unchanged. A pattern with no capture group
 * replaces its whole match.
 */
export function redactCredentialShapes(text: string): string {
  let result = text;
  for (const { re } of patterns()) {
    result = result.replace(re, (match: string, captured?: unknown) => {
      const target = typeof captured === "string" && captured.length > 0 ? captured : match;
      return match.replace(target, CREDENTIAL_REDACTION);
    });
  }
  return result;
}
