import "../src/app/globals.css";

export const metadata = {
  title: "Wezen Payroll",
  description: "Secure payroll portal for Wezen Staffing contractors and administrators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
