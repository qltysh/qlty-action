import { HttpClient } from "@actions/http-client";
import type { IncomingHttpHeaders } from "node:http";
import type { Readable } from "node:stream";

export interface HttpResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Readable;
}

export interface HttpTransport {
  get(url: string, headers?: Record<string, string>): Promise<HttpResponse>;
}

const SOCKET_TIMEOUT_MS = 30_000;

// @actions/http-client honors https_proxy and no_proxy, like the
// @actions/tool-cache download, so verification works through the same proxy.
export class ActionsHttpTransport implements HttpTransport {
  private client = new HttpClient("qltysh/qlty-action", [], {
    // A redirect could send the Authorization header somewhere unexpected.
    allowRedirects: false,
    // Retries 502, 503 and 504.
    allowRetries: true,
    maxRetries: 2,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  async get(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<HttpResponse> {
    const response = await this.client.get(url, headers);
    return {
      statusCode: response.message.statusCode ?? 0,
      headers: response.message.headers,
      body: response.message,
    };
  }
}

export async function readBody(
  body: Readable,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      body.destroy();
      throw new Error(`The response is larger than ${maxBytes} bytes.`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

// Errors where the request never got an answer, so trying later may work.
const TRANSIENT_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);

// OpenSSL certificate verification errors, as Node reports them in error.code.
const CERTIFICATE_ERROR_CODES = new Set([
  "CERT_CHAIN_TOO_LONG",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_REJECTED",
  "CERT_REVOKED",
  "CERT_SIGNATURE_FAILURE",
  "CERT_UNTRUSTED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "HOSTNAME_MISMATCH",
  "INVALID_CA",
  "INVALID_PURPOSE",
  "PATH_LENGTH_EXCEEDED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY",
  "UNABLE_TO_DECRYPT_CERT_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

export function isTransientNetworkError(error: unknown): boolean {
  return errorChain(error).some(
    (e) =>
      TRANSIENT_ERROR_CODES.has(errorCode(e)) ||
      // @actions/http-client reports its socket timeout without a code.
      (e instanceof Error && e.message.startsWith("Request timeout:")),
  );
}

export function isTlsError(error: unknown): boolean {
  return errorChain(error).some((e) => {
    const code = errorCode(e);
    return (
      CERTIFICATE_ERROR_CODES.has(code) ||
      code.startsWith("ERR_TLS_") ||
      code.startsWith("ERR_SSL_")
    );
  });
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = error;
  while (current !== undefined && current !== null && chain.length < 10) {
    chain.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return chain;
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = errorCode(error);
    const message = error.message || error.name;
    return code && !message.includes(code) ? `${message} (${code})` : message;
  }
  return String(error);
}
