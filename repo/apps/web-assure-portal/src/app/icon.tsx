import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#B0CEE2',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          color: '#1A2730',
          fontFamily: 'sans-serif',
          fontWeight: 700,
          fontSize: 20,
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
