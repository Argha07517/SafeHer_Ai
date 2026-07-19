import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch("/api/route", {
  method:"POST",
  headers:{
    "Content-Type":"application/json"
  },
  body:JSON.stringify({
    coordinates:[
      [sourceLng, sourceLat],
      [destLng, destLat]
    ]
  })
});

const data = await response.json();

    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: "Route fetching failed" },
      { status: 500 }
    );
  }
}