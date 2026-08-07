import "server-only";
import { createAdminApiClient } from "@shopify/admin-api-client";
import type { LogContent } from "@shopify/admin-api-client";
import { getShopifyAdminConfig } from "./config";
import { getShopifyAccessToken } from "./accessToken";

/**
 * Log retry otomatis dari library (kena rate limit 429 / Service
 * Unavailable 503) -- selain log manual "-> / <-" di bawah, ini bantu
 * lihat kalau request-nya sebenarnya sempat gagal beberapa kali dulu
 * sebelum akhirnya sukses/gagal total.
 */
function logShopifyClientEvent(logContent: LogContent) {
  if (logContent.type === "HTTP-Retry") {
    const { retryAttempt, maxRetries, requestParams } = logContent.content as {
      retryAttempt: number;
      maxRetries: number;
      requestParams: [string, unknown?];
    };
    console.warn(
      `[shopify] retry ${retryAttempt}/${maxRetries} -> ${requestParams[0]}`,
    );
  }
}

/**
 * Panggil Shopify Admin GraphQL API lewat `@shopify/admin-api-client`
 * (resmi dari Shopify) -- gantiin raw `fetch` manual sebelumnya. Client ini
 * yang urus pembuatan URL (jadi tidak ada lagi risiko lupa/dobel prefix
 * `https://`) dan retry otomatis kalau kena rate limit (429) / Service
 * Unavailable (503), tanpa perlu OAuth/session management yang tidak
 * kepakai di custom app kita (beda dari `@shopify/shopify-api` yang jauh
 * lebih berat -- lihat diskusi sebelumnya soal kenapa itu tidak dipakai).
 */
export async function shopifyAdminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { storeDomain, apiVersion } = getShopifyAdminConfig();
  const accessToken = await getShopifyAccessToken();

  const client = createAdminApiClient({
    storeDomain,
    apiVersion,
    accessToken,
    retries: 2,
    logger: logShopifyClientEvent,
  });

  const url = client.getApiUrl();
  const startedAt = Date.now();
  console.log(`[shopify] -> POST ${url}`);

  const { data, errors } = await client.request<T>(query, { variables });

  console.log(`[shopify] <- POST ${url} (${Date.now() - startedAt}ms)`);

  if (errors) {
    console.error("[shopify] graphql error:", errors);
    if (errors.graphQLErrors?.length) {
      throw new Error(
        `Shopify GraphQL error: ${errors.graphQLErrors.map((e) => e.message).join("; ")}`,
      );
    }
    throw new Error(
      `Shopify API error (${errors.networkStatusCode ?? "?"}): ${errors.message ?? "unknown"}`,
    );
  }
  if (!data) {
    throw new Error("Shopify GraphQL: respons kosong");
  }
  return data;
}
