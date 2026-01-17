"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      body: JSON.stringify({
        ...formData,
        email: formData.email.trim(),
        password: formData.password.trim(),
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      router.push("/login"); // Sukses! Pindah ke login
    } else {
      const data = await res.json();
      setError(data.message); // Menampilkan pesan "Email sudah terpakai" dsb.
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="p-8 bg-white rounded shadow-md w-96"
      >
        <h2 className="text-2xl font-bold mb-4">Daftar Akun</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <input
          type="text"
          placeholder="Nama"
          required
          className="w-full p-2 mb-3 border rounded"
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          required
          className="w-full p-2 mb-3 border rounded"
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          required
          className="w-full p-2 mb-4 border rounded"
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
        />

        <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
          Registrasi
        </button>
      </form>
    </div>
  );
}
