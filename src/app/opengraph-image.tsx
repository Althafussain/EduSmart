import { ImageResponse } from "next/og";

export const alt =
  "EduSmart e-Mind, Sri Lanka O/L and A/L learning and exam practice";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "#18312f",
          background:
            "linear-gradient(135deg, #f6faf8 0%, #e4f1eb 65%, #d4e9df 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#267b68",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "14px",
              color: "#ffffff",
              background: "#267b68",
              fontSize: 38,
            }}
          >
            e
          </div>
          EduSmart
          <span style={{ color: "#c88624" }}>· e-Mind</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              color: "#267b68",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "4px",
            }}
          >
            LEARN · PRACTISE · PROGRESS
          </div>
          <div
            style={{
              maxWidth: 970,
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-2px",
            }}
          >
            Sri Lanka O/L & A/L exam preparation
          </div>
        </div>
        <div style={{ color: "#52756a", fontSize: 24 }}>
          Focused learning and exam practice for students
        </div>
      </div>
    ),
    size,
  );
}
