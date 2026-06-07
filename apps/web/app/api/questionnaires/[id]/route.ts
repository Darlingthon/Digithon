import { NextResponse } from "next/server";
import { prisma } from "@trustline/db";
import { getCurrentOrg } from "@/lib/session";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const q = await prisma.questionnaire.findFirst({ where: { id, orgId: org.id } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ questionnaire: q });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const org = await getCurrentOrg();
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
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const existing = await prisma.questionnaire.findFirst({ where: { id, orgId: org.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.questionnaire.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
