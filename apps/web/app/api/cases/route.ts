import { NextResponse } from "next/server";
import { BrainError, listCases, startCase } from "@trustline/db";

export async function GET() {
  try {
    return NextResponse.json({ cases: await listCases() });
  } catch (error) {
    return toError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kase = await startCase({
      entityName: body.entityName,
      phone: body.phone,
      email: body.email,
      country: body.country,
      riskTier: body.riskTier,
    });
    return NextResponse.json({ case: kase }, { status: 201 });
  } catch (error) {
    return toError(error);
  }
}

function toError(error: unknown) {
  if (error instanceof BrainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
}
