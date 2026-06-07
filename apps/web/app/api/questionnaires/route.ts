import { NextResponse } from "next/server";
import { prisma } from "@trustline/db";
import { getCurrentOrg } from "@/lib/session";
import type { RiskTier as PrismaRiskTier } from "@prisma/client";

export async function GET() {
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const questionnaires = await prisma.questionnaire.findMany({
    where: { orgId: org.id },
    orderBy: [{ riskTier: "asc" }, { version: "desc" }],
  });
  return NextResponse.json({ questionnaires });
}

export async function POST(request: Request) {
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, riskTier, questions } = body;

  if (!name || !riskTier || !questions) {
    return NextResponse.json({ error: "name, riskTier, and questions are required" }, { status: 400 });
  }

  const lastVersion = await prisma.questionnaire.findFirst({
    where: { orgId: org.id, riskTier: riskTier as PrismaRiskTier },
    orderBy: { version: "desc" },
  });

  await prisma.questionnaire.updateMany({
    where: { orgId: org.id, riskTier: riskTier as PrismaRiskTier, isActive: true },
    data: { isActive: false },
  });

  const created = await prisma.questionnaire.create({
    data: {
      orgId: org.id,
      name,
      riskTier: riskTier as PrismaRiskTier,
      version: (lastVersion?.version ?? 0) + 1,
      questions,
      isActive: true,
    },
  });

  return NextResponse.json({ questionnaire: created }, { status: 201 });
}
