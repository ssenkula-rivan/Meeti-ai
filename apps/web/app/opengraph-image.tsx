import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Static social card (og:image / twitter:image) rendered at build time.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1220',
          padding: '0 90px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(160deg, #0030F0 0%, #0CCFFB 100%)',
              gap: 10,
            }}
          >
            <div style={{ width: 16, height: 54, borderRadius: 8, background: '#ffffff' }} />
            <div style={{ width: 16, height: 92, borderRadius: 8, background: '#ffffff' }} />
            <div style={{ width: 16, height: 40, borderRadius: 8, background: '#ffffff' }} />
            <div style={{ width: 16, height: 74, borderRadius: 8, background: '#ffffff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 108, fontWeight: 700, color: '#ffffff', letterSpacing: -2 }}>
              Meeti
            </div>
            <div style={{ fontSize: 40, color: '#9fb4d8' }}>
              Turn meetings into actionable notes
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
