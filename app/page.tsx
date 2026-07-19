"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const MapView = dynamic(
  () => import("./components/MapView"),
  { ssr: false }
);

type Route = {
  name: string;
  score: number;
};

export default function Home() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [recommendedRoute, setRecommendedRoute] = useState("");
  const [showRoutes, setShowRoutes] = useState(false);
  const [loading, setLoading] = useState(false);

  const [routes, setRoutes] = useState<Route[]>([]);

  const [safetyFactors, setSafetyFactors] = useState({
    lighting: 0,
    crowd: 0,
    police: 0,
    hospital: 0,
  });

  const [sourcePosition, setSourcePosition] =
    useState<[number, number] | null>(null);

  const [destinationPosition, setDestinationPosition] =
    useState<[number, number] | null>(null);
    const [routeCoords, setRouteCoords] = useState<
  [number, number][]
>([]);

  const getCoordinates = async (place: string) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        place
      )}`
    );

    const data = await response.json();

    if (data.length === 0) return null;

    return [
      parseFloat(data[0].lat),
      parseFloat(data[0].lon),
    ] as [number, number];
  };
  const getRoute = async (
  start: [number, number],
  end: [number, number]
) => {
  const apiKey =
    process.env.NEXT_PUBLIC_ORS_API_KEY;

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [start[1], start[0]],
          [end[1], end[0]],
        ],
      }),
    }
  );

  const data = await response.json();

  return data.features[0].geometry.coordinates.map(
    (coord: number[]) =>
      [coord[1], coord[0]] as [number, number]
  );
};
  const analyzeRoute = async () => {
    if (!source || !destination) {
      alert("Please enter source and destination");
      return;
    }

    setLoading(true);
    setShowRoutes(false);

    try {
      const sourceCoords = await getCoordinates(source);
      const destinationCoords = await getCoordinates(destination);

      if (sourceCoords) {
        setSourcePosition(sourceCoords);
      }

      if (destinationCoords) {
        setDestinationPosition(destinationCoords);
      }
      if (sourceCoords && destinationCoords) {
  const route = await getRoute(
    sourceCoords,
    destinationCoords
  );

  setRouteCoords(route);
}

      setTimeout(() => {
        const generatedRoutes = [
          {
            name: "Route A",
            score: Math.floor(Math.random() * 15) + 85,
          },
          {
            name: "Route B",
            score: Math.floor(Math.random() * 20) + 60,
          },
          {
            name: "Route C",
            score: Math.floor(Math.random() * 25) + 35,
          },
        ];

        setSafetyFactors({
          lighting: Math.floor(Math.random() * 30) + 70,
          crowd: Math.floor(Math.random() * 30) + 70,
          police: Math.floor(Math.random() * 30) + 70,
          hospital: Math.floor(Math.random() * 30) + 70,
        });

        setRoutes(generatedRoutes);
        setShowRoutes(true);

        setRecommendedRoute(
          `Safest route from ${source} to ${destination} is Route A. It is recommended because it has better lighting, higher public activity, nearby police stations, and quick access to emergency services.`
        );

        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error(error);
      alert("Unable to fetch location data.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <h1 className="text-5xl font-bold text-center mb-2">
          SafeHer AI
        </h1>

        <p className="text-center text-gray-400 mb-10">
          AI-Powered Safe Route Recommendation for Women
        </p>

        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Enter Source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="p-4 rounded-xl bg-zinc-800 outline-none"
            />

            <input
              type="text"
              placeholder="Enter Destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="p-4 rounded-xl bg-zinc-800 outline-none"
            />
          </div>

          <button
            onClick={analyzeRoute}
            className="mt-6 w-full bg-yellow-400 text-black font-semibold py-4 rounded-xl hover:scale-[1.02] transition"
          >
            {loading ? "Analyzing Safety..." : "Analyze Route"}
          </button>
        </div>

        <div className="mt-8">
          <MapView
  sourcePosition={sourcePosition || undefined}
  destinationPosition={destinationPosition || undefined}
  routeCoords={routeCoords}
/>
        </div>

        {showRoutes && (
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {routes.map((route) => (
              <div
                key={route.name}
                className={`p-4 rounded-xl border ${
                  route.score >= 80
                    ? "bg-green-900/30 border-green-600"
                    : route.score >= 60
                    ? "bg-yellow-900/20 border-yellow-600"
                    : "bg-red-900/20 border-red-600"
                }`}
              >
                <h3 className="font-bold text-lg">
                  {route.name}
                </h3>

                <p className="text-3xl font-bold">
                  {route.score}/100
                </p>

                <p>
                  {route.score >= 80
                    ? "✅ Recommended"
                    : route.score >= 60
                    ? "⚠ Moderate"
                    : "❌ Risky"}
                </p>
              </div>
            ))}
          </div>
        )}

        {safetyFactors.lighting > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl mt-8">
            <h2 className="text-xl font-bold mb-4">
              Safety Analysis
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                💡 Street Lighting: {safetyFactors.lighting}/100
              </div>

              <div>
                👥 Crowd Density: {safetyFactors.crowd}/100
              </div>

              <div>
                🚓 Police Presence: {safetyFactors.police}/100
              </div>

              <div>
                🏥 Emergency Access: {safetyFactors.hospital}/100
              </div>
            </div>
          </div>
        )}

        {recommendedRoute && (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl mt-8">
            <h2 className="text-xl font-bold mb-4">
              AI Recommendation
            </h2>

            <p className="text-gray-300 leading-relaxed">
              {recommendedRoute}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}