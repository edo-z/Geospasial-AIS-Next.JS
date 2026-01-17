import Link from "next/link";
import { TbScanPosition,TbTableExport, TbAnchor } from "react-icons/tb";
import { SiPagespeedinsights } from "react-icons/si";
import { MdOutlineMonitorHeart } from "react-icons/md";
import { IoIosLogIn } from "react-icons/io";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-base-100 selection:bg-primary selection:text-white">
      {/* 1. NAVBAR */}
      <div className="navbar bg-base-100/80 backdrop-blur-md sticky top-0 z-50 px-4 md:px-12 border-b border-base-200">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-black text-2xl tracking-tighter text-primary">
            <TbAnchor /> AIS <span className="text-base-content font-light italic">SPATIAL</span>
          </div>
        </div>
        <div className="flex-none gap-4 hidden md:flex">
          <Link href="/login" className="btn btn-ghost btn-sm rounded-lg font-bold">Log In<IoIosLogIn /></Link>
          <Link href="/dashboard" className="btn btn-primary btn-sm rounded-lg shadow-md shadow-primary/20">Get Started</Link>
        </div>
      </div>

      {/* 2. HERO SECTION */}
      <div className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
        {/* Dekorasi Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-10">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary rounded-full blur-[150px]"></div>
        </div>

        <div className="container mx-auto px-6 text-center">
          
          
          <h1 className="text-5xl md:text-7xl font-black text-base-content mb-6 tracking-tight">
            Visualisasikan Data AIS <br /> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 italic">
              Tanpa Batas Geografis.
            </span>
          </h1>
          
          <p className="text-lg text-base-content/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Platform pemantauan kapal laut tercanggih dengan fitur filter poligon spasial, 
            analisis kecepatan real-time, dan manajemen database MongoDB yang terintegrasi.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/dashboard" className="btn btn-primary btn-lg rounded-2xl px-8 shadow-xl hover:scale-105 transition-all">
              <MdOutlineMonitorHeart /> Buka Dashboard </Link>
          </div>
        </div>
      </div>

      {/* 3. FEATURE CARDS */}
      <div className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
            <div className="card-body">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
               <TbScanPosition />
              </div>
              <h3 className="card-title font-bold">Polygon Filtering</h3>
              <p className="text-sm opacity-60">Pilih area spesifik di peta menggunakan koordinat poligon untuk mendapatkan data kapal yang presisi.</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
            <div className="card-body">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                <SiPagespeedinsights />
              </div>
              <h3 className="card-title font-bold">High Speed Query</h3>
              <p className="text-sm opacity-60">Didukung oleh sistem indexing 2dsphere MongoDB untuk pencarian data jutaan records dalam milidetik.</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
            <div className="card-body">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                <TbTableExport />
              </div>
              <h3 className="card-title font-bold">Export Ready</h3>
              <p className="text-sm opacity-60">Unduh hasil pemantauan Anda ke dalam format Excel atau CSV secara instan untuk kebutuhan laporan.</p>
            </div>
          </div>

        </div>
      </div>

      {/* 4. FOOTER */}
      <footer className="footer footer-center p-10 bg-base-200 text-base-content rounded">
        
        <aside>
          <p className="font-bold opacity-50">
            AIS SPATIAL SYSTEM © 2024 - AIS SPATIAL
          </p>
        </aside>
      </footer>
    </div>
  );
}