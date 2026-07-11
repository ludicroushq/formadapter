import { ImageResponse } from "next/og";

export const alt = "FormAdapter — Build typed forms from your existing schemas";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#f8f9fb",
        color: "#17181c",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: 48,
        width: "100%",
      }}
    >
      <div
        style={{
          background: "white",
          border: "2px solid #e2e5ea",
          borderRadius: 28,
          display: "flex",
          height: "100%",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 48,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              gap: 14,
            }}
          >
            <span
              style={{
                alignItems: "center",
                background: "#5b5bd6",
                borderRadius: 12,
                color: "white",
                display: "flex",
                height: 48,
                justifyContent: "center",
                width: 48,
              }}
            >
              FA
            </span>
            FormAdapter
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <span
              style={{
                color: "#5b5bd6",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Zod · ArkType · React
            </span>
            <strong
              style={{
                fontSize: 61,
                fontWeight: 750,
                letterSpacing: -3,
                lineHeight: 1,
              }}
            >
              Build typed forms from the schemas you already have.
            </strong>
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            background: "#f1f1ff",
            borderLeft: "2px solid #e2e5ea",
            display: "flex",
            justifyContent: "center",
            padding: 38,
            width: 420,
          }}
        >
          <div
            style={{
              background: "white",
              border: "2px solid #d7d9e0",
              borderRadius: 18,
              boxShadow: "0 18px 45px rgba(23,24,28,0.10)",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              padding: 26,
              width: "100%",
            }}
          >
            <strong style={{ fontSize: 24 }}>Create your workspace</strong>
            <span style={{ color: "#646b78", fontSize: 16 }}>Work email</span>
            <div
              style={{
                border: "2px solid #d7d9e0",
                borderRadius: 9,
                color: "#646b78",
                display: "flex",
                fontSize: 16,
                padding: "13px 16px",
              }}
            >
              ada@example.com
            </div>
            <span style={{ color: "#646b78", fontSize: 16 }}>Account type</span>
            <div style={{ display: "flex", gap: 10 }}>
              <span
                style={{
                  border: "2px solid #5b5bd6",
                  borderRadius: 9,
                  color: "#5b5bd6",
                  display: "flex",
                  flex: 1,
                  justifyContent: "center",
                  padding: 12,
                }}
              >
                Company
              </span>
              <span
                style={{
                  background: "#5b5bd6",
                  borderRadius: 9,
                  color: "white",
                  display: "flex",
                  flex: 1,
                  justifyContent: "center",
                  padding: 12,
                }}
              >
                Continue
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
