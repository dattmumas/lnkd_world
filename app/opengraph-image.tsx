import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LNKD — Philosophy, politics, and ideas worth exploring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FAFAF8",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "80px",
              fontWeight: 700,
              color: "#1B3A5C",
              letterSpacing: "8px",
            }}
          >
            LNKD
          </div>
          <div
            style={{
              width: "60px",
              height: "2px",
              backgroundColor: "#1B3A5C",
            }}
          />
          <div
            style={{
              fontSize: "24px",
              color: "#666",
              maxWidth: "600px",
              textAlign: "center",
              lineHeight: "1.5",
            }}
          >
            Philosophy, politics, and the ideas that shape how we live.
          </div>
          <div
            style={{
              fontSize: "16px",
              color: "#999",
              marginTop: "16px",
            }}
          >
            lnkd.world
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
