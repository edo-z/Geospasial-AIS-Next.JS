import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./lib/db";
import bcrypt from "bcrypt";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // 1. Validasi input awal
        if (!credentials?.email || !credentials?.password) {
          console.log("❌ Error: Email atau password tidak diisi");
          return null;
        }

        const client = await clientPromise;
        const db = client.db("magang-ais");

        // 2. Cari user di database
        const user = await db.collection("user").findOne({ 
          email: credentials.email 
        });

        console.log("🔍 Mencari email:", credentials.email);
        console.log("👤 User ditemukan di DB:", user ? "Ya" : "Tidak");

        if (!user || !user.password) {
          console.log("❌ Error: User tidak ditemukan atau tidak memiliki password");
          return null;
        }

        // 3. Verifikasi password dengan Bcrypt
        // Pastikan password di DB adalah hasil hash, bukan teks biasa
        const isMatch = await bcrypt.compare(
          credentials.password as string, 
          user.password
        );

        console.log("🔑 Password cocok:", isMatch);

        if (isMatch) {
          console.log("✅ Login berhasil untuk:", user.email);
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        }

        console.log("❌ Error: Password salah");
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET, // Pastikan ini ada di .env.local
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});