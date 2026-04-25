import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wezen Staffing App",
  description: "Wezen Staffing mobile app portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
