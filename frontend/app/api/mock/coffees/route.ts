import { NextResponse } from "next/server";
import { MOCK_COFFEES } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(MOCK_COFFEES);
}
