export interface StartStripeCheckoutDeps {
  fetchFn?: typeof fetch;
  redirect?: (url: string) => void;
  returnTo?: string | null;
}

export type StartStripeCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Starts a Stripe checkout session for the given product and redirects the
 * browser to the hosted checkout page.
 *
 * The request/response shape mirrors the `/api/payments/checkout` route: the
 * body is `{ productId }` and a successful response contains `{ url }`.
 */
export async function startStripeCheckout(
  productId: string,
  deps: StartStripeCheckoutDeps = {}
): Promise<StartStripeCheckoutResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const redirect =
    deps.redirect ??
    ((url: string) => {
      window.location.href = url;
    });

  const res = await fetchFn("/api/payments/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(deps.returnTo ? { productId, returnTo: deps.returnTo } : { productId }),
  });

  const data = (await res.json().catch(() => null)) as {
    url?: string;
    error?: string;
  } | null;

  if (!res.ok) {
    return {
      ok: false,
      error: data?.error ?? "Failed to create checkout session.",
    };
  }

  if (!data?.url) {
    return { ok: false, error: "Missing checkout URL." };
  }

  redirect(data.url);
  return { ok: true, url: data.url };
}
