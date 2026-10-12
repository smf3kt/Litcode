import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREDENTIAL_REDACTION,
  CREDENTIAL_SHAPES,
  credentialShapeIds,
  redactCredentialShapes,
} from "../src/credential-shapes.js";

// One sample per family, written with the prefix the provider publishes. The
// bodies are padding, not real tokens: a pattern matches on shape, and these
// fixtures carry no credential.
const SAMPLES: Record<string, string> = {
  "aws-access-token": "AKIAIOSFODNN7EXAMPLE",
  "gcp-api-key": `AIza${"a".repeat(35)}`,
  "google-oauth-client-secret": "GOCSPX-abcdefghijklmnopqrstuvwxyz12",
  "azure-ad-client-secret": "abc8Q~abcdefghijklmnopqrstuvwxyz0123456",
  "digitalocean-pat": `dop_v1_${"a".repeat(64)}`,
  "digitalocean-access-token": `doo_v1_${"b".repeat(64)}`,
  "anthropic-api-key": `sk-ant-api03-${"A".repeat(93)}AA`,
  "anthropic-admin-api-key": `sk-ant-admin01-${"B".repeat(93)}AA`,
  "anthropic-oauth-token": "sk-ant-oat01-abcdefghijklmnopqrst",
  "openai-api-key": "sk-abcdefghT3BlbkFJabcdefgh",
  "openai-legacy-api-key": `sk-${"a".repeat(48)}`,
  "huggingface-access-token": `hf_${"a".repeat(34)}`,
  "supabase-secret-key": "sb_secret_abcdefghijklmnopqrst",
  "supabase-access-token": `sbp_${"a".repeat(40)}`,
  "github-pat": `ghp_${"a".repeat(36)}`,
  "github-fine-grained-pat": `github_pat_${"a".repeat(82)}`,
  "github-app-token": `ghu_${"a".repeat(36)}`,
  "github-oauth": `gho_${"a".repeat(36)}`,
  "github-refresh-token": `ghr_${"a".repeat(36)}`,
  "gitlab-pat": `glpat-${"a".repeat(20)}`,
  "gitlab-deploy-token": `gldt-${"a".repeat(20)}`,
  "gitlab-runner-authentication-token": `glrt-${"a".repeat(20)}`,
  "gitlab-oauth-app-secret": `gloas-${"a".repeat(20)}`,
  "gitlab-pipeline-trigger-token": `glptt-${"a".repeat(20)}`,
  "gitlab-kubernetes-agent-token": `glagent-${"a".repeat(20)}`,
  "gitlab-incoming-mail-token": `glimt-${"a".repeat(20)}`,
  "gitlab-scim-oauth-token": `glsoat-${"a".repeat(20)}`,
  "gitlab-ci-build-token": `glcbt-${"a".repeat(20)}`,
  "gitlab-feed-token": `glft-${"a".repeat(20)}`,
  "gitlab-feature-flag-client-token": `glffct-${"a".repeat(20)}`,
  "slack-bot-token": "xoxb-1234567890-1234567890-abcdef",
  "slack-user-token": `xoxp-1234567890-1234567890-1234567890-${"a".repeat(28)}`,
  "slack-rotation-token": `xoxe-1-${"a".repeat(28)}`,
  "slack-app-token": "xapp-1-A0123456789-1234567890-abcdef",
  "slack-workflow-token": `xwfp-${"a".repeat(20)}`,
  "slack-webhook-url": `https://hooks.slack.com/services/${"a".repeat(40)}`,
  "twilio-api-key": `SK${"a".repeat(32)}`,
  "sendgrid-api-token": `SG.${"a".repeat(66)}`,
  "npm-access-token": `npm_${"a".repeat(36)}`,
  "pypi-upload-token": `pypi-AgEIcHlwaS5vcmc${"a".repeat(50)}`,
  "databricks-api-token": `dapi${"a".repeat(32)}`,
  "hashicorp-tf-api-token": `${"a".repeat(14)}.atlasv1.${"b".repeat(60)}`,
  "pulumi-api-token": `pul-${"a".repeat(40)}`,
  "postman-api-token": `PMAK-${"a".repeat(24)}-${"b".repeat(34)}`,
  "grafana-api-key": `eyJrIjoi${"a".repeat(70)}`,
  "grafana-cloud-api-token": `glc_${"a".repeat(32)}`,
  "grafana-service-account-token": `glsa_${"a".repeat(32)}_${"a".repeat(8)}`,
  "sentry-user-token": `sntryu_${"a".repeat(64)}`,
  "sentry-org-token": `sntrys_eyJpYXQiO${"a".repeat(10)}LCJyZWdpb25fdXJs${"b".repeat(10)}_${"c".repeat(43)}`,
  "stripe-access-token": `sk_live_${"a".repeat(10)}`,
  "shopify-access-token": `shpat_${"a".repeat(32)}`,
  "shopify-shared-secret": `shpss_${"a".repeat(32)}`,
};

test("every family in the table has a sample, and every sample is recognized", () => {
  const ids = CREDENTIAL_SHAPES.map(shape => shape.id);
  assert.equal(ids.length, 52);
  for (const id of ids) assert.ok(SAMPLES[id], `no sample for ${id}`);
  for (const [id, sample] of Object.entries(SAMPLES)) {
    assert.ok(credentialShapeIds(sample).includes(id), `${id} did not match ${sample}`);
  }
});

test("a recognized span is replaced and the text around it survives", () => {
  const key = SAMPLES["aws-access-token"]!;
  const line = `credential=${key}&region=us-east-1`;
  assert.equal(redactCredentialShapes(line), `credential=${CREDENTIAL_REDACTION}&region=us-east-1`);
  // A pattern whose match carries trailing context replaces only the token.
  const npm = SAMPLES["npm-access-token"]!;
  assert.equal(redactCredentialShapes(`token "${npm}" here`), `token "${CREDENTIAL_REDACTION}" here`);
  // Several spans in one string are all replaced.
  const both = `${SAMPLES["github-pat"]!} and ${SAMPLES["slack-bot-token"]!}`;
  assert.equal(redactCredentialShapes(both), `${CREDENTIAL_REDACTION} and ${CREDENTIAL_REDACTION}`);
});

test("ordinary text is left alone", () => {
  for (const text of [
    "the akia prefix is not a key on its own",
    "AKIA is a prefix, not a credential",
    "https://example.test/a/b?token=short",
    "sk- is how the legacy prefix begins",
    "hooks.slack.com is a host, not a webhook",
    "glpat- is the prefix GitLab documents",
    "GOCSPX- is the beginning of the client secret format",
  ]) {
    assert.equal(redactCredentialShapes(text), text, text);
    assert.deepEqual(credentialShapeIds(text), [], text);
  }
  // A prefix alone is short of the format, so it is not a match.
  assert.equal(redactCredentialShapes(`ghp_${"a".repeat(35)}`), `ghp_${"a".repeat(35)}`);
  assert.equal(redactCredentialShapes(`AKIA${"A".repeat(15)}`), `AKIA${"A".repeat(15)}`);
});

test("the ambiguous entries are deliberately absent from the table", () => {
  const ids = new Set(CREDENTIAL_SHAPES.map(shape => shape.id));
  for (const absent of ["url-userinfo", "sensitive-assign", "loose-jwt", "http-auth-scheme",
    "cloud-env-var", "loose-anthropic-key", "gcp-service-account", "masked-value-rest"]) {
    assert.equal(ids.has(absent), false, absent);
  }
  // The shape those entries would have caught is left untouched, so a URL with
  // credentials in it is not silently rewritten by a broad rule.
  assert.equal(redactCredentialShapes("https://user:password@example.test/"), "https://user:password@example.test/");
  assert.equal(redactCredentialShapes("password = hunter2"), "password = hunter2");
});

test("the table compiles once and matching does not carry state between calls", () => {
  const key = SAMPLES["github-pat"]!;
  assert.deepEqual(credentialShapeIds(key), credentialShapeIds(key));
  assert.equal(redactCredentialShapes(key), redactCredentialShapes(key));
  // A global regex re-used across calls must not skip a second occurrence.
  assert.equal(redactCredentialShapes(`${key} ${key}`), `${CREDENTIAL_REDACTION} ${CREDENTIAL_REDACTION}`);
  assert.equal(credentialShapeIds(`${key} ${key}`).filter(id => id === "github-pat").length, 1);
});
