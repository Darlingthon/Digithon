import { NextResponse } from "next/server";
import { prisma, getOrCreateOrg } from "@trustline/db";
import { getSession } from "@/lib/session";
import { withAuth } from "@workos-inc/authkit-nextjs";

async function resolveOrg() {
  const session = await getSession();
  if (!session?.orgId) return null;
  const auth = await withAuth();
  return getOrCreateOrg(session.orgId, auth.user?.firstName ?? "My Org");
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const org = await resolveOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const q = await prisma.questionnaire.findFirst({ where: { id, orgId: org.id } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ questionnaire: q });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const org = await resolveOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const existing = await prisma.questionnaire.findFirst({ where: { id, orgId: org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, questions, isActive } = body;

  const updated = await prisma.questionnaire.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(questions !== undefined && { questions }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ questionnaire: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const org = await resolveOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const existing = await prisma.questionnaire.findFirst({ where: { id, orgId: org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.questionnaire.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
