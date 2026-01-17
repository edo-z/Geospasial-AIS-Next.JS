import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SpatialFilter from "@/components/SpatialFilter";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Penerapan Geosphere Polygon</h1>
        <p className="text-gray-500">Log: {session.user?.email}</p>
      </div>
      
      <SpatialFilter />
    </div>
  );
}