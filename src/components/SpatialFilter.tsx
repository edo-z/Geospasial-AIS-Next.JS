"use client";

import { useState, useEffect, useRef } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { BiSolidFileExport } from "react-icons/bi";
import { MdAddLocationAlt, MdDeleteSweep } from "react-icons/md"; // Tambah ikon hapus
import { LuCalendarSearch } from "react-icons/lu";
import { renderToString } from "react-dom/server";
import { SiSpaceship } from "react-icons/si";
import { BsFillCalendarDateFill } from "react-icons/bs";
import { FaMapMarkedAlt } from "react-icons/fa";
import { MdDeleteForever } from "react-icons/md";

interface Ship {
  _id: { $oid: string };
  mmsi: string;
  sog: number;
  cog: number;
  hdg: number;
  rot: number;
  class: string;
  channel: string;
  aistype: number;
  port_origin: string;
  original: string;
  navstatus: number;
  created_at: { $date: string } | string | any;
  loc: {
    type: string;
    coordinates: [number, number];
  };
}

export default function SpatialFilter() {
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const draw = useRef<any>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const REFRESH_INTERVAL = 5000;
  const [mapStyle, setMapStyle] = useState("voyager"); // Default style
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedAreas, setSavedAreas] = useState<any[]>([]);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [activePreset, setActivePreset] = useState("1h");

  // Fungsi untuk menghitung waktu berdasarkan preset
  const applyTimePreset = (preset: string) => {
    const now = new Date();
    let start = new Date();

    // Logika kalkulasi waktu
    switch (preset) {
      case "1h": start.setHours(now.getHours() - 1); break;
      case "3h": start.setHours(now.getHours() - 3); break;
      case "12h": start.setHours(now.getHours() - 12); break;
      case "3d": start.setDate(now.getDate() - 3); break;
      case "1w": start.setDate(now.getDate() - 7); break;
      case "1m": start.setMonth(now.getMonth() - 1); break;
      case "6m": start.setMonth(now.getMonth() - 6); break;
      case "12m": start.setFullYear(now.getFullYear() - 1); break;
      default: return;
    }

    // ATOMIC UPDATE: Memperbarui semua state terkait secara sinkron
    // Gunakan setter function untuk memastikan kita menggunakan snapshot state terbaru
    setStartTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
    setEndTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);

    // Karena preset bisa melintasi hari, kita set selectedDate ke tanggal MULAI preset
    setSelectedDate(start.toISOString().split("T")[0]);

    setActivePreset(preset);
    setPage(1); // Reset pagination selalu di akhir
  };
  const deleteArea = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Agar tidak memicu fungsi loadAreaToMap saat klik tombol hapus

    if (!confirm("Apakah Anda yakin ingin menghapus area ini?")) return;

    try {
      const res = await fetch(`/api/area/delete?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Refresh daftar area setelah berhasil dihapus
        fetchSavedAreas();
      } else {
        alert("Gagal menghapus area");
      }
    } catch (err) {
      console.error("Error deleting area:", err);
    }
  };
  const [coords, setCoords] = useState({
    minLon: 100.24397377949515,
    maxLon: 132.1385128695669,
    minLat: -10.758484142438164,
    maxLat: 4.972030973918365,
  });
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [ships, setShips] = useState<Ship[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalData, setTotalData] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Ship | "time";
    direction: "asc" | "desc";
  }>({
    key: "time",
    direction: "desc",
  });

  const limit = 100;

  const formatShipDate = (dateVal: any) => {
    if (!dateVal) return "N/A";
    const date = new Date(dateVal.$date || dateVal);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "medium",
      hourCycle: "h23",
    }).format(date);
  };

  const handleOpenSaveModal = () => {
    // Cek apakah ada gambar di peta
    const data = draw.current?.getAll();
    if (!data || data.features.length === 0) {
      alert("Please draw an area first!");
      return;
    }
    setIsSaveModalOpen(true);
  };

  const saveAreaToDB = async () => {
    const data = draw.current?.getAll();
    if (!data || data.features.length === 0) return;

    setIsSaving(true);
    try {
      // Ambil feature pertama (asumsi user menggambar 1 area)
      const geometry = data.features[0].geometry;

      const res = await fetch("/api/area/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: areaName,
          geometry: geometry, // Mengirim object geometry GeoJSON
        }),
      });

      if (res.ok) {
        alert("Area saved successfully!");
        setIsSaveModalOpen(false);
        setAreaName("");
      } else {
        alert("Failed to save area.");
      }
    } catch (error) {
      console.error("Error saving area:", error);
      alert("Error saving area.");
    } finally {
      setIsSaving(false);
    }
  };

  // Ambil daftar area dari database
  const fetchSavedAreas = async () => {
    setIsLoadingAreas(true);
    try {
      const res = await fetch("/api/area/list");
      const data = await res.json();
      setSavedAreas(data);
    } catch (err) {
      console.error("Error fetching areas:", err);
    } finally {
      setIsLoadingAreas(false);
    }
  };

  // Masukkan area yang dipilih ke peta
  const loadAreaToMap = (area: any) => {
    if (!draw.current || !map.current) return;

    // Bersihkan gambar yang ada sekarang
    draw.current.deleteAll();

    // Tambahkan area dari database ke Draw Tool
    const featureId = draw.current.add({
      type: "Feature",
      properties: {},
      geometry: area.location,
    });

    // Fokuskan kamera peta ke area tersebut
    const coords = area.location.coordinates[0];
    const bounds = coords.reduce(
      (acc: any, coord: any) => acc.extend(coord),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );

    map.current.fitBounds(bounds, { padding: 50 });

    // PENTING: Update state coords agar useEffect fetch kapal otomatis jalan
    const lons = coords.map((c: any) => c[0]);
    const lats = coords.map((c: any) => c[1]);
    setCoords({
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    });
  };

  // Ambil data saat pertama kali aplikasi dibuka
  useEffect(() => {
    fetchSavedAreas();
  }, []);

  // Fungsi Kontrol Draw (Dipindahkan ke luar useEffect agar bisa diakses tombol)
  const startDrawing = () => {
    if (draw.current && map.current) {
      // Clear previous shapes first (assuming single-filter logic)
      draw.current.deleteAll();
      // Change mode to drawing
      draw.current.changeMode("draw_polygon");
    }
  };

  const clearDrawing = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setCoords({ minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 });
      setShips([]);
      setTotalData(0);
    }
  };

  const mapStyles: Record<string, any> = {
    voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
    light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    satellite: {
      version: 8,
      sources: {
        "satellite-tiles": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Esri",
        },
      },
      layers: [{ id: "satellite", type: "raster", source: "satellite-tiles" }],
    },
    enc: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  };

  useEffect(() => {
    if (map.current) {
      const selected = mapStyles[mapStyle as keyof typeof mapStyles];
      map.current.setStyle(selected as any);
    }
  }, [mapStyle]);


  // EFFECT 0: Update Markers saat data kapal atau gaya peta berubah
  useEffect(() => {
    if (!map.current) return;

    // Bersihkan marker lama
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const currentFeatures = draw.current?.getAll();
    map.current.setStyle(mapStyles[mapStyle]);

    map.current.once("style.load", () => {
      // Jika user memilih ENC, tambahkan overlay OpenSeaMap di atas peta Voyager
      if (mapStyle === "enc") {
        // 1. Tambahkan Source Seamark
        if (!map.current?.getSource("seamark")) {
          map.current?.addSource("seamark", {
            type: "raster",
            tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
            tileSize: 256,
          });
        }

        // 2. Tambahkan Layer Seamark
        if (!map.current?.getLayer("seamark-layer")) {
          map.current?.addLayer({
            id: "seamark-layer",
            type: "raster",
            source: "seamark",
            paint: { "raster-opacity": 1 },
          });
        }
      }

      // Kembalikan Draw Tool
      if (map.current && draw.current) {
        if (!map.current.hasControl(draw.current)) {
          map.current.addControl(draw.current);
        }
        draw.current.add(currentFeatures);
      }
    });

    ships.forEach((ship) => {
      // 1. Render ikon React ke string HTML
      const iconString = renderToString(
        <div style={{
          color: ship.sog > 0.5 ? "#22c55e" : "#94a3b8",
          transform: `rotate(${ship.cog || 0}deg)`,
          transition: "all 0.3s ease",
        }}>
          <SiSpaceship size={20} />
        </div>
      );

      // 2. Buat elemen DOM untuk menampung ikon
      const el = document.createElement("div");
      el.innerHTML = iconString;
      el.className = "hover:scale-110 transition-transform duration-900";

      // 3. Popup yang lebih lengkap (seperti request sebelumnya)
      const popupHTML = `
      <div style="padding: 10px; font-family: sans-serif; color: #1e293b; min-width: 180px;">
        <div style="border-bottom: 2px solid #3b82f6; margin-bottom: 8px; padding-bottom: 4px;">
          <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #1e40af;">MMSI: ${ship.mmsi
        }</h3>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
          <div>
            <b style="color: #64748b; font-size: 9px; text-transform: uppercase; display: block;">Speed</b>
            <span>${ship.sog} kn</span>
          </div>
          <div>
            <b style="color: #64748b; font-size: 9px; text-transform: uppercase; display: block;">Course</b>
            <span>${ship.cog}°</span>
          </div>
          <div style="grid-column: span 2; border-top: 1px solid #f1f5f9; padding-top: 6px;">
            <b style="color: #64748b; font-size: 9px; text-transform: uppercase; display: block;">Last Update</b>
            <span style="font-family: monospace;">${formatShipDate(
          ship.created_at
        )}</span>
          </div>
        </div>
      </div>
    `;

      // 4. Tambahkan ke peta
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([ship.loc.coordinates[0], ship.loc.coordinates[1]])
        .setPopup(
          new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(
            popupHTML
          )
        )
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [ships]);
  // EFFECT 1: Inisialisasi Peta dan Draw Tool
  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current!,
      style: mapStyles.voyager,
      center: [112.75, -1.2],
      zoom: 4,
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      styles: [
        {
          id: "gl-draw-polygon-fill-inactive",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: {
            "fill-color": "#3b82f6",
            "fill-outline-color": "#3b82f6",
            "fill-opacity": 0.1,
          },
        },
        {
          id: "gl-draw-polygon-stroke-inactive",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: { "line-color": "#3b82f6", "line-width": 2 },
        },
        {
          id: "gl-draw-polygon-and-line-vertex-inactive",
          type: "circle",
          filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
          paint: { "circle-radius": 5, "circle-color": "#3b82f6" },
        },
      ],
    });

    map.current.addControl(draw.current);

    // --- BAGIAN PENTING YANG HILANG ---
    // Pasang Event Listener agar React tahu saat gambar selesai
    map.current.on("draw.create", updateArea);
    map.current.on("draw.update", updateArea);
    map.current.on("draw.delete", updateArea);
    // -----------------------------------

    // Resize handler untuk Mobile
    const resizer = () => map.current?.resize();
    window.addEventListener("resize", resizer);

    return () => window.removeEventListener("resize", resizer);
  }, []);

  // Fungsi untuk update state saat gambar selesai
  const updateArea = () => {
    if (!draw.current) return;

    const data = draw.current.getAll();

    if (data.features.length > 0) {
      const geometry = data.features[0].geometry;
      // @ts-ignore - Mapbox Draw types kadang tidak lengkap
      const coordinates = geometry.coordinates[0]; // Array of [lon, lat]

      // Cari Min/Max untuk membuat Bounding Box (sesuai logika fetchShips Anda)
      const lons = coordinates.map((c: any) => c[0]);
      const lats = coordinates.map((c: any) => c[1]);

      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      setCoords({ minLon, maxLon, minLat, maxLat });
      setPage(1); // Reset halaman ke 1 setiap area berubah
    } else {
      // Jika user menghapus area (tombol tong sampah)
      setCoords({ minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 });
      setShips([]);
      setTotalData(0);
    }
  };
  // EFFECT 2: Ganti gaya peta saat mapStyle berubah
  useEffect(() => {
    if (!map.current) return;

    // 1. Ambil data polygon yang sedang digambar agar tidak hilang
    let currentFeatures: any = { type: 'FeatureCollection', features: [] };
    if (draw.current) {
      try {
        currentFeatures = draw.current.getAll();
      } catch (e) {
        console.warn("Draw not ready yet");
      }
    }

    // 2. Terapkan Style Peta Baru
    map.current.setStyle(mapStyles[mapStyle]);

    // 3. Eksekusi setelah style baru dimuat
    map.current.once("style.load", () => {
      if (!map.current) return;

      // --- LOGIK ENC ---
      if (mapStyle === "enc") {
        // Tambahkan Source
        if (!map.current.getSource("seamark")) {
          map.current.addSource("seamark", {
            type: "raster",
            tiles: ["https://t1.openseamap.org/seamark/{z}/{x}/{y}.png"],
            tileSize: 256,
            scheme: "xyz", // Pastikan scheme xyz digunakan
            attribution: 'Map data © <a href="http://www.openseamap.org">OpenSeaMap</a>'
          });
        }

        // Tambahkan Layer
        if (!map.current.getLayer("seamark-layer")) {
          map.current.addLayer({
            id: "seamark-layer",
            type: "raster",
            source: "seamark",
            paint: {
              "raster-opacity": 1.0
            },
          }, "marker-layer-id");
        }
      }

      // --- RE-ATTACH DRAW CONTROL ---
      // Ganti style menghapus semua control yang menempel pada style lama
      if (draw.current) {
        if (map.current.hasControl(draw.current)) {
          map.current.removeControl(draw.current);
        }
        map.current.addControl(draw.current);

        // Gunakan sedikit delay agar buffer canvas siap
        setTimeout(() => {
          if (draw.current && currentFeatures.features.length > 0) {
            draw.current.add(currentFeatures);
          }
        }, 100);
      }
    });
  }, [mapStyle]);

  // EFFECT 3: Fetch Data Spasial
  useEffect(() => {
    // 1. Guard Clause: Jangan jalankan jika koordinat belum valid
    if (!coords || coords.minLon === 0) return;

    const fetchShips = async () => {
      setLoading(true);
      try {
        // 2. Tentukan Range Waktu secara Sinkron (Atomic Logic)
        const now = new Date();
        let startDateTime: Date;
        let endDateTime: Date;

        if (activePreset) {
          // Jika ada preset, hitung mundur dari 'now'
          endDateTime = now;
          startDateTime = new Date(now);

          if (activePreset === "1h") startDateTime.setHours(now.getHours() - 1);
          else if (activePreset === "3h") startDateTime.setHours(now.getHours() - 3);
          else if (activePreset === "12h") startDateTime.setHours(now.getHours() - 12);
          else if (activePreset === "3d") startDateTime.setDate(now.getDate() - 3);
          else if (activePreset === "1w") startDateTime.setDate(now.getDate() - 7);
          else if (activePreset === "1m") startDateTime.setMonth(now.getMonth() - 1);
          else if (activePreset === "6m") startDateTime.setMonth(now.getMonth() - 6);
          else if (activePreset === "12m") startDateTime.setFullYear(now.getFullYear() - 1);
        } else {
          // Jika tidak ada preset (Custom Mode), gunakan input manual
          startDateTime = new Date(`${selectedDate}T${startTime}:00`);
          endDateTime = new Date(`${selectedDate}T${endTime}:59`);
        }

        // 3. Eksekusi API Call
        const res = await fetch("/api/ais/spatial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            points: [
              [coords.minLon, coords.minLat],
              [coords.maxLon, coords.minLat],
              [coords.maxLon, coords.maxLat],
              [coords.minLon, coords.maxLat],
              [coords.minLon, coords.minLat],
            ],
            page,
            limit,
            startDate: startDateTime.toISOString(),
            endDate: endDateTime.toISOString(),
          }),
        });

        const data = await res.json();
        setShips(data.ships || []);
        setTotalPages(data.totalPages || 1);
        setTotalData(data.total || 0);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShips();

    // ATUR TIMER: Hanya jika preset adalah "1h" (Mode LIVE)
    let intervalId: NodeJS.Timeout;
    if (activePreset === "1h") {
      intervalId = setInterval(() => {
        console.log("Auto-refreshing live data...");
        fetchShips();
      }, REFRESH_INTERVAL);
    }

    // Cleanup: Hapus interval saat user ganti preset atau pindah halaman
    return () => {
      if (intervalId) clearInterval(intervalId);
    };

  }, [coords, page, selectedDate, startTime, endTime, activePreset]);

  const getMs = (ship: Ship) => {
    const dateValue = ship.created_at;
    return new Date(dateValue?.$date || dateValue).getTime();
  };

  const sortedShips = [...ships].sort((a, b) => {
    let valA: any, valB: any;
    if (sortConfig.key === "time") {
      valA = getMs(a);
      valB = getMs(b);
    } else {
      valA = (a as any)[sortConfig.key];
      valB = (b as any)[sortConfig.key];
    }
    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("AIS Data");
    worksheet.columns = [
      { header: "MMSI", key: "mmsi", width: 15 },
      { header: "SOG", key: "sog", width: 10 },
      { header: "COG", key: "cog", width: 10 },
      { header: "HDG", key: "hdg", width: 10 },
      { header: "Lon", key: "lon", width: 15 },
      { header: "Lat", key: "lat", width: 15 },
      { header: "Timestamp", key: "time", width: 25 },
    ];
    sortedShips.forEach((s) => {
      worksheet.addRow({
        mmsi: s.mmsi,
        sog: s.sog,
        cog: s.cog,
        hdg: s.hdg,
        lon: s.loc.coordinates[0],
        lat: s.loc.coordinates[1],
        time: formatShipDate(s.created_at),
      });
    });
    worksheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `AIS_Export_${selectedDate}.xlsx`);
  };

  return (
    <div className="container mx-auto space-y-6 pb-10 px-4 text-black font-sans">
      {/* 1. STATS BAR */}
      <div className="stats shadow bg-white border w-full mt-6">
        <div className="stat">
          <div className="stat-title text-gray-500 text-xs font-black uppercase">
            <SiSpaceship className="inline text-primary mb-1" /> Vessels
            Detected
          </div>
          <div className="stat-value text-primary">
            {totalData.toLocaleString()}
          </div>
          <div className="stat-desc font-medium">In selected boundary</div>
        </div>
        <div className="stat">
          <div className="stat-title text-gray-500 text-xs font-black uppercase">
            <BsFillCalendarDateFill className="inline text-secondary mb-1" />{" "}
            Date Range
          </div>
          <div className="stat-value text-sm font-bold">
            {new Date(selectedDate).toLocaleDateString("id-ID", {
              dateStyle: "long",
            })}
          </div>
          <div className="stat-desc text-secondary font-bold">
            {startTime} - {endTime} WIB
          </div>
        </div>
      </div>

      {/* 2. MAP & FILTER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 relative rounded-xl overflow-hidden border shadow-lg">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
          <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm p-2 rounded-lg text-[10px] font-bold shadow-md border border-gray-200">
            Click <span className="text-primary">Polygon Tool</span> on the
            sidebar to filter area
          </div>
        </div>

        <div className="space-y-4">
          {/* Tools Panel */}
          {/* Map Style Switcher */}
          <div className="card bg-white shadow-sm border border-gray-200 p-5 space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-400 border-b pb-2 flex items-center gap-2">
              <FaMapMarkedAlt className="inline text-lg" /> Base Map Layers
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMapStyle("voyager")}
                className={`btn btn-xs ${mapStyle === "voyager" ? "btn-primary" : "btn-outline"
                  }`}
              >
                Voyager
              </button>
              <button
                onClick={() => setMapStyle("satellite")}
                className={`btn btn-xs ${mapStyle === "satellite" ? "btn-primary" : "btn-outline"
                  }`}
              >
                Satellite
              </button>
              <button
                onClick={() => setMapStyle("dark")}
                className={`btn btn-xs ${mapStyle === "dark" ? "btn-primary" : "btn-outline"
                  }`}
              >
                Dark
              </button>
              <button
                onClick={() => setMapStyle("enc")}
                className={`btn btn-xs ${mapStyle === "enc" ? "btn-primary" : "btn-outline"
                  }`}
              >
                Seamap
              </button>
            </div>
          </div>
          <div className="card bg-white shadow-sm border border-gray-200 p-5 space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-400 border-b pb-2 flex items-center gap-2">
              <MdAddLocationAlt className="text-lg" /> Spatial Tools
            </h3>
            <button
              onClick={startDrawing}
              className="btn btn-primary btn-sm w-full font-bold"
            >
              <MdAddLocationAlt /> Draw Polygon
            </button>
            <button
              onClick={clearDrawing}
              className="btn btn-outline btn-error btn-sm w-full font-bold"
            >
              <MdDeleteSweep /> Clear Area
            </button>
            <button
              onClick={handleOpenSaveModal}
              className="btn btn-secondary btn-sm w-full font-bold text-white"
            >
              <BiSolidFileExport /> Save Area
            </button>
          </div>

          <div className="card bg-white shadow-sm border border-gray-200 p-5 space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-400 border-b pb-2 flex items-center gap-2">
              <FaMapMarkedAlt className="text-lg" /> Saved Monitoring Zones
            </h3>


            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {isLoadingAreas ? (
                <div className="text-center py-2 animate-pulse text-[10px]">Loading areas...</div>
              ) : savedAreas.length === 0 ? (
                <div className="text-center py-2 text-[10px] text-gray-400 italic">No saved areas</div>
              ) : (
                savedAreas.map((area) => (
                  <div key={area._id} className="group relative">
                    <button
                      onClick={() => loadAreaToMap(area)}
                      className="flex items-center justify-between w-full p-2 text-left text-[11px] font-bold bg-slate-50 hover:bg-blue-50 border rounded-lg transition-colors"
                    >
                      <span className="truncate w-32">{area.name}</span>
                      <span className="text-[9px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Load »
                      </span>
                    </button>

                    {/* Tombol Hapus - Muncul saat hover */}
                    <button
                      onClick={(e) => deleteArea(e, area._id)}
                      className="absolute -right-2 -top-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      title="Hapus Area"
                    >
                      <MdDeleteForever size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={fetchSavedAreas}
              className="btn btn-ghost btn-xs w-full text-[9px] uppercase"
            >
              Refresh List
            </button>
          </div>

          {/* Time Filter Panel */}
          <div className="card bg-white shadow-sm border border-gray-200 p-5 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-400 border-b pb-2 flex items-center gap-2">
              <LuCalendarSearch className="text-lg" /> Time Range Presets
            </h3>
            {activePreset === "1h" && (
              <div className="flex items-center justify-between mb-2 bg-red-50 p-2 rounded-lg border border-red-100">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                    Live Mode Active
                  </span>
                </div>
                {/* Opsional: Jika Anda menambah state counter refresh */}
                <span className="text-[9px] text-red-400 font-mono italic">
                  Auto-sync in 5s
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "LIVE", value: "1h" },
                { label: "3 Hours", value: "3h" },
                { label: "12 Hours", value: "12h" },
                { label: "3 Days", value: "3d" },
                { label: "1 Week", value: "1w" },
                { label: "1 Month", value: "1m" },
                { label: "6 Months", value: "6m" },
                { label: "1 Year", value: "12m" },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => applyTimePreset(preset.value)}
                  className={`btn btn-xs normal-case font-bold ${activePreset === preset.value
                    ? "btn-primary"
                    : "btn-outline btn-ghost bg-slate-50"
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="divider my-0 text-[10px] text-gray-300">OR CUSTOM</div>

            {/* Input manual tetap dipertahankan di bawah untuk fleksibilitas */}
            <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setActivePreset(""); }}
                className="input input-bordered input-xs w-full font-medium"
              />
              <div className="flex gap-1">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setActivePreset(""); }}
                  className="input input-bordered input-xs w-1/2"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setActivePreset(""); }}
                  className="input input-bordered input-xs w-1/2"
                />
              </div>
            </div>

            <button
              onClick={handleExportExcel}
              className="btn btn-success btn-sm w-full text-white font-bold shadow-md"
            >
              <BiSolidFileExport /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* 3. TABLE SECTION */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-8 transition-all">
        {/* Table Header Info */}
        <div className="bg-slate-800 p-4 px-6 flex justify-between items-center">
          <h3 className="text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Vessel Monitoring List
          </h3>
          <div className="text-[10px] text-slate-300 font-medium">
            Displaying {sortedShips.length} of {totalData} vessels
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="table w-full border-separate border-spacing-0">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 uppercase text-[10px] tracking-wider">
                <th 
                  className="py-4 px-6 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setSortConfig({
                    key: "mmsi",
                    direction: sortConfig.key === "mmsi" && sortConfig.direction === "asc" ? "desc" : "asc",
                  })}
                >
                  MMSI {sortConfig.key === "mmsi" && (sortConfig.direction === "asc" ? "▴" : "▾")}
                </th>
                <th 
                  className="cursor-pointer hover:text-primary transition-colors text-center"
                  onClick={() => setSortConfig({
                    key: "sog",
                    direction: sortConfig.key === "sog" && sortConfig.direction === "asc" ? "desc" : "asc",
                  })}
                >
                  Speed (SOG) {sortConfig.key === "sog" && (sortConfig.direction === "asc" ? "▴" : "▾")}
                </th>
                <th 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setSortConfig({
                    key: "time",
                    direction: sortConfig.key === "time" && sortConfig.direction === "asc" ? "desc" : "asc",
                  })}
                >
                  Last Reported {sortConfig.key === "time" && (sortConfig.direction === "asc" ? "▴" : "▾")}
                </th>
                <th>Position (Lon, Lat)</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                /* SKELETON LOADER STATE */
                [...Array(5)].map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td colSpan={5} className="p-6">
                      <div className="h-4 bg-slate-100 rounded-full w-full mb-2"></div>
                      <div className="h-3 bg-slate-50 rounded-full w-2/3"></div>
                    </td>
                  </tr>
                ))
              ) : sortedShips.length === 0 ? (
                /* EMPTY STATE */
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center opacity-30">
                      <SiSpaceship size={48} className="mb-4 text-slate-400" />
                      <p className="text-sm font-black uppercase tracking-widest">No Data Available</p>
                      <p className="text-xs italic mt-1">Adjust your spatial filter or time range</p>
                    </div>
                  </td>
                </tr>
              ) : (
                /* DATA ROWS */
                sortedShips.map((ship, i) => (
                  <tr 
                    // PERBAIKAN KEY: Menggabungkan MMSI, Timestamp, dan Index i untuk menjamin keunikan
                    key={`${ship.mmsi}-${ship.created_at}-${i}`} 
                    className="hover:bg-blue-50/40 transition-all group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-blue-800 text-sm tracking-tight">{ship.mmsi}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Class {ship.class || 'A'}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm border ${
                        ship.sog > 0.5 
                        ? "bg-emerald-500 text-white border-emerald-400" 
                        : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        {ship.sog} kn
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col text-[11px]">
                        <span className="text-slate-700 font-semibold">{formatShipDate(ship.created_at)}</span>
                        <span className="text-[9px] text-slate-400 font-mono italic">
                          {activePreset === '1h' ? 'Live Track' : 'Historical Data'}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-[10px] text-slate-500">
                      {ship.loc.coordinates[0].toFixed(5)}, {ship.loc.coordinates[1].toFixed(5)}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => {
                          setSelectedShip(ship);
                          map.current?.flyTo({
                            center: [ship.loc.coordinates[0], ship.loc.coordinates[1]],
                            zoom: 15,
                            speed: 1.5,
                            essential: true
                          });
                        }}
                        className="btn btn-xs btn-primary rounded-lg font-bold shadow-sm transition-all group-hover:scale-110"
                      >
                        Detail View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Improved Pagination Section */}
        <div className="p-5 flex flex-col sm:flex-row justify-between items-center bg-slate-50 border-t border-slate-200 gap-4">
          <div className="flex items-center gap-4">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                Total Found: <span className="text-primary">{totalData.toLocaleString()}</span> Records
             </div>
             {activePreset === '1h' && (
                <span className="text-[9px] text-emerald-600 font-bold animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Auto-Sync Active
                </span>
             )}
          </div>

          <div className="join bg-white border border-slate-200 shadow-sm overflow-hidden rounded-xl">
            <button
              disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="join-item btn btn-xs px-4 bg-white hover:bg-slate-50 border-none transition-colors"
            >
              PREV
            </button>
            <div className="join-item flex items-center px-4 text-[10px] font-bold text-slate-500 border-x border-slate-100 bg-slate-50/50">
              PAGE {page} OF {totalPages}
            </div>
            <button
              disabled={page === totalPages}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="join-item btn btn-xs px-4 bg-white hover:bg-slate-50 border-none transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      </div>

      {/* 4. DETAIL MODAL */}
      {selectedShip && (
        <div className="modal modal-open">
          <div className="modal-box bg-white text-black border-t-8 border-primary rounded-2xl">
            <h3 className="font-black text-xl flex items-center gap-2">
              Vessel: {selectedShip.mmsi}
            </h3>
            <div className="grid grid-cols-2 gap-4 py-6">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">
                  SOG / COG
                </p>
                <p className="font-bold text-lg">
                  {selectedShip.sog} kn / {selectedShip.cog}°
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">
                  HDG / ROT
                </p>
                <p className="font-bold text-lg">
                  {selectedShip.hdg || "N/A"} / {selectedShip.rot || "N/A"}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">
                  Channel / Class
                </p>
                <p className="font-bold text-lg">
                  {selectedShip.channel || "N/A"} /{" "}
                  {selectedShip.class || "N/A"}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">
                  AIS Type
                </p>
                <p className="font-bold text-lg">
                  {selectedShip.aistype || "N/A"}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">
                  Last Updated
                </p>
                <p className="font-bold text-lg">
                  {formatShipDate(selectedShip.created_at)}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-gray-400 uppercase">
                  Port / Nav Status
                </p>
                <p className="font-bold text-lg">
                  {selectedShip.port_origin || "N/A"} /{" "}
                  {selectedShip.navstatus || "N/A"}
                </p>
              </div>

              <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase">
                  AIS Messages
                </p>
                <p className="font-mono font-bold text-blue-700">
                  {selectedShip.original || "N/A"}
                </p>
              </div>
            </div>
            <div className="modal-action">
              <button
                onClick={() => setSelectedShip(null)}
                className="btn btn-primary w-full rounded-xl font-bold uppercase"
              >
                Close Information
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedShip(null)}
          ></div>
        </div>
      )}
      {/* 5. SAVE AREA MODAL */}
      {isSaveModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box bg-white text-black">
            <h3 className="font-bold text-lg">Save Spatial Area</h3>
            <p className="py-4 text-sm text-gray-500">
              Give a name to this monitoring area to access it later.
            </p>

            <div className="form-control w-full">
              <label className="label">
                <span className="label-text font-bold">Area Name</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Patrol Zone Alpha"
                className="input input-bordered w-full"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsSaveModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn btn-secondary text-white"
                onClick={saveAreaToDB}
                disabled={!areaName || isSaving}
              >
                {isSaving ? "Saving..." : "Save to Database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
