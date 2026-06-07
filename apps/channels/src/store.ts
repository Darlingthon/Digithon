import { prisma } from "@trustline/db";

// Thin persistence helpers. All wrapped so the service still works if the DB
// isn't reachable (hackathon: never let a logging write break the demo flow).

export async function audit(caseId: string, type: string, data?: unknown) {
  try {
    await prisma.auditEvent.create({
      data: { caseId, type, actor: "vera", data: (data as any) ?? undefined },
    });
  } catch (e) {
    console.warn(`⚠️  audit(${type}) skipped:`, (e as Error).message);
  }
}

export async function createOtpSession(caseId: string, providerRef: string) {
  try {
    return await prisma.otpSession.create({
      data: { caseId, channel: "sms", providerRef, verified: false },
    });
  } catch (e) {
    console.warn("⚠️  createOtpSession skipped:", (e as Error).message);
    return null;
  }
}

export async function markOtpVerified(caseId: string) {
  try {
    await prisma.otpSession.updateMany({
      where: { caseId, verified: false },
      data: { verified: true },
    });
  } catch (e) {
    console.warn("⚠️  markOtpVerified skipped:", (e as Error).message);
  }
}
