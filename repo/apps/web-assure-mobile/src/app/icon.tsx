/**
 * App icon -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Genere l'icone de l'application via next/og ImageResponse.
 * Couleur de fond : Sky Blue #2D5773 (assure mobile).
 * decision-006 : aucune emoji.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#2D5773',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          A
        </span>
      </div>
    ),
    { ...size },
  );
}
