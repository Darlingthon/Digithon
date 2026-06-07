import { prisma } from "./index";
import { QUESTIONNAIRE, questionsForTier } from "@trustline/shared";
import { Prisma, RiskTier } from "@prisma/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function uniqueSlug(base: string, suffix: number): string {
  return suffix === 0 ? base : `${base}-${suffix}`;
}

export async function getOrCreateOrg(workosOrgId: string, name: string) {
  const existing = await prisma.organisation.findUnique({
    where: { workosOrgId },
  });
  if (existing) return existing;

  const baseSlug = slugify(name) || "org";
  let slug = baseSlug;
  let attempt = 0;
  while (await prisma.organisation.findUnique({ where: { slug } })) {
    attempt++;
    slug = uniqueSlug(baseSlug, attempt);
  }

  const org = await prisma.organisation.create({
    data: {
      workosOrgId,
      name,
      slug,
      questionnaires: {
        create: (["LOW", "MEDIUM", "HIGH"] as RiskTier[]).map((tier) => ({
          name: `${name} — ${tier} Risk`,
          riskTier: tier,
          version: 1,
          questions: questionsForTier(tier as any) as unknown as Prisma.InputJsonValue,
          isActive: true,
        })),
      },
    },
  });

  return org;
}

export async function getOrCreateMember(
  workosUserId: string,
  email: string,
  orgId: string,
) {
  return prisma.member.upsert({
    where: { workosUserId },
    update: {},
    create: { workosUserId, email, orgId, role: "REVIEWER" },
  });
}

export async function getOrgByWorkosId(workosOrgId: string) {
  return prisma.organisation.findUnique({ where: { workosOrgId } });
}
