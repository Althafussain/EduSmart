import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.e-mindd.com"),
  title: "EduSmart Sri Lanka | Your learning, in motion",
  description: "Personalized learning and examinations for Sri Lankan students.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>
  );
}
