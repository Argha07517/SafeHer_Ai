"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";

import { LatLngExpression } from "leaflet";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

type MapViewProps = {
  sourcePosition?: LatLngExpression;
  destinationPosition?: LatLngExpression;
  routeCoords?: LatLngExpression[];
};

export default function MapView({
  sourcePosition,
  destinationPosition,
  routeCoords,
}: MapViewProps) {
  return (
    <MapContainer
      center={[22.5726, 88.3639]}
      zoom={12}
      scrollWheelZoom={true}
      style={{
        height: "500px",
        width: "100%",
        borderRadius: "20px",
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {sourcePosition && (
        <Marker position={sourcePosition}>
          <Popup>
            <strong>📍 Source Location</strong>
          </Popup>
        </Marker>
      )}

      {destinationPosition && (
        <Marker position={destinationPosition}>
          <Popup>
            <strong>📍 Destination Location</strong>
          </Popup>
        </Marker>
      )}

      {routeCoords && routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: "blue",
            weight: 6,
          }}
        />
      )}
    </MapContainer>
  );
}