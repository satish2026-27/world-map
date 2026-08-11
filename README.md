# 🌍 Interactive World Map

A single-file interactive world map application built with [Leaflet.js](https://leafletjs.com/) and OpenStreetMap data.

## Features

- **Zoom in / Zoom out / Drill-down** – scroll or use the +/− controls; double-click to zoom into any region
- **Map layers** – switch between Street, Satellite, and Topographic views
- **Location search** – type any city, address, or landmark with real-time autocomplete
- **Click-to-pin** – click the 📌 button then click anywhere on the map to drop a marker
- **Draggable markers** – drag either marker to fine-tune a location
- **Distance calculation** – straight-line (haversine) distance between the two selected points
- **Travel time estimation** – choose a travel mode (🚗 Drive / 🚶 Walk / 🚴 Bike / ✈️ Fly) to get an estimated journey time
- **Great-circle route** – curved geodesic line drawn between the two locations
- **Collapsible sidebar** – keep the map full-screen when you don't need the info panel
- **Scale bar** – metric & imperial scale shown on the map

## Usage

1. Open `index.html` in any modern browser (no build step needed).
2. Search for **Location A** and **Location B** using the search boxes, or click 📌 to pin directly on the map.
3. Select a travel mode, then click **Calculate** to see distance and estimated time.
4. Use **Clear** to reset and start over.

## Tech Stack

| Library | Purpose |
|---|---|
| [Leaflet 1.9.4](https://leafletjs.com/) | Interactive map rendering |
| [OpenStreetMap](https://openstreetmap.org/) | Base map tiles |
| [Nominatim](https://nominatim.org/) | Geocoding & reverse geocoding |
| Esri World Imagery | Satellite tiles |
| OpenTopoMap | Topographic tiles |

No build tools or server required — everything runs in the browser.
