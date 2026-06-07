import { withAuth } from "@workos-inc/authkit-nextjs";
import { getOrCreateOrg } from "@trustline/db";

export interface AppSession {
  userId: string;
  email: string;
  // The org the user acts in. When the WorkOS user belongs to an organization we
  // use that; otherwise we fall back to a stable personal-org key derived from the
  // user id so a standalone account still gets its own tenant (no "No organisation").
  orgId: string;
  // Friendly name used when first provisioning the org.
  orgName: string;
  // True when orgId came from a real WorkOS organization (vs. a personal fallback).
  hasWorkosOrg: boolean;
}

export async function getSession(): Promise<AppSession | null> {
  const auth = await withAuth();
  if (!auth.user) return null;

  const workosOrgId = auth.organizationId ?? null;
  const displayName =
    [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") ||
    auth.user.email ||
    "My Org";

  return {
    userId: auth.user.id,
    email: auth.user.email,
    orgId: workosOrgId ?? `personal:${auth.user.id}`,
    orgName: displayName,
    hasWorkosOrg: Boolean(workosOrgId),
  };
}

// Resolve (and lazily provision) the Organisation row for the current session.
// Returns null only when the request is unauthenticated.
export async function getCurrentOrg() {
  const session = await getSession();
  if (!session) return null;
  return getOrCreateOrg(session.orgId, session.orgName);
}
