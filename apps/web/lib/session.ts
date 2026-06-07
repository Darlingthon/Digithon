import { withAuth } from "@workos-inc/authkit-nextjs";

export interface AppSession {
  userId: string;
  email: string;
  orgId: string | null;
}

export async function getSession(): Promise<AppSession | null> {
  const auth = await withAuth();
  if (!auth.user) return null;

  return {
    userId: auth.user.id,
    email: auth.user.email,
    orgId: auth.organizationId ?? null,
  };
}
