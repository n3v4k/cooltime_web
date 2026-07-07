import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "lat, lon 쿼리 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENWEATHER_API_KEY가 설정되지 않았습니다.",
        fallback: true,
      },
      { status: 200 }
    );
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`OpenWeatherMap 응답 오류: ${res.status}`);
    }
    const data = await res.json();

    const temp: number = data.main?.temp;
    const feelsLike: number = data.main?.feels_like;
    const humidity: number = data.main?.humidity;
    const locationName: string = data.name;

    return NextResponse.json({
      temp,
      feelsLike,
      humidity,
      locationName,
      fallback: false,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "날씨 조회 실패",
        fallback: true,
      },
      { status: 200 }
    );
  }
}
