'use strict';

const { fromSSO } = require('@aws-sdk/credential-provider-sso');
const { SignatureV4 } = require('@smithy/signature-v4');
const { HttpRequest } = require('@smithy/protocol-http');
const { Sha256 } = require('@aws-crypto/sha256-js');

async function signedRequest(config, payload, credentials) {
  const url = new URL(config.endpoint);
  const body = JSON.stringify(payload);
  const signer = new SignatureV4({ credentials, region: config.region, service: 'execute-api', sha256: Sha256 });
  return signer.sign(new HttpRequest({ protocol: url.protocol, hostname: url.hostname,
    port: url.port ? Number(url.port) : undefined, method: 'POST', path: url.pathname,
    headers: { host: url.host, 'content-type': 'application/json' }, body }));
}

async function send(config, payload, { credentials, fetchImpl = fetch } = {}) {
  // Explicit SSO provider: no environment keys, credential_process, IMDS or shared-key fallback.
  const identity = credentials || await fromSSO({ profile: config.profile,
    clientConfig: { maxAttempts: 1, ignoreConfiguredEndpointUrls: true } })();
  if (payload === null) return; // --check authenticates without submitting a fake event.
  const request = await signedRequest(config, payload, identity);
  const response = await fetchImpl(config.endpoint, { method: 'POST', headers: request.headers,
    body: request.body, redirect: 'error', signal: AbortSignal.timeout(4500) });
  await response.body?.cancel();
  if (!response.ok) throw new Error('event rejected');
}

module.exports = { signedRequest, send };
