import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="corporate"> 
      <body>
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}