import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.e-mindd.com"),
  title: {
    default: "EduSmart (e-Mind) | O/L & A/L Exam Prep in Sri Lanka",
    template: "%s | EduSmart (e-Mind)",
  },
  description:
    "Looking for EduSmart, e-Mind, or Exam Mind? Prepare for Sri Lanka O/L and A/L exams with exam practice, past papers, and progress tracking.",
  applicationName: "EduSmart",
  keywords: [
    "EduSmart",
    "e-Mind",
    "eMind",
    "Exam Mind",
    "Sri Lanka exam preparation",
    "O/L exam practice Sri Lanka",
    "A/L exam practice Sri Lanka",
    "Sri Lankan past papers",
    "student learning platform",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_LK",
    url: "https://www.e-mindd.com/",
    siteName: "EduSmart",
    title: "EduSmart (e-Mind) | O/L & A/L Exam Prep in Sri Lanka",
    description:
      "Looking for EduSmart, e-Mind, or Exam Mind? Explore exam practice, past papers, and progress tracking for Sri Lankan O/L and A/L students.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EduSmart (e-Mind) | O/L & A/L Exam Prep in Sri Lanka",
    description:
      "Focused learning, exam practice, past papers, and progress tracking for Sri Lankan O/L and A/L students.",
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.e-mindd.com/#website",
      url: "https://www.e-mindd.com/",
      name: "EduSmart",
      alternateName: ["e-Mind", "eMind", "Exam Mind"],
      inLanguage: "en-LK",
    },
    {
      "@type": "EducationalOrganization",
      "@id": "https://www.e-mindd.com/#organization",
      name: "EduSmart Sri Lanka",
      alternateName: ["e-Mind", "eMind", "Exam Mind"],
      url: "https://www.e-mindd.com/",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.e-mindd.com/#application",
      name: "EduSmart",
      alternateName: ["e-Mind", "eMind", "Exam Mind"],
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: "https://www.e-mindd.com/",
      description:
        "A learning and exam-practice platform for Sri Lankan students preparing for O/L and A/L exams.",
      publisher: {
        "@id": "https://www.e-mindd.com/#organization",
      },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
