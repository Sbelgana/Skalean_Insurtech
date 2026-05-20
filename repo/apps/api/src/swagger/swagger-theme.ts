/**
 * Theme Skalean : couleur primaire #B0CEE2 Sky Blue, typo Inter, logo SVG inline.
 *
 * Reference : decision-006 + brand guidelines Skalean.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */

const SKALEAN_LOGO_SVG_BASE64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMjAiPjx0ZXh0IHg9IjAiIHk9IjE2IiBmb250LWZhbWlseT0iSW50ZXIsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IiM0Mzc4OWEiPlNrYWxlYW48L3RleHQ+PHRleHQgeD0iNTUiIHk9IjE2IiBmb250LWZhbWlseT0iSW50ZXIsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiIGZpbGw9IiM2NjYiPkluc3VyVGVjaDwvdGV4dD48L3N2Zz4=';

export const SKALEAN_THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  --skalean-primary: #43789a;
  --skalean-primary-light: #B0CEE2;
  --skalean-primary-dark: #2a4d65;
  --skalean-accent: #f59e0b;
  --skalean-success: #10b981;
  --skalean-warning: #f59e0b;
  --skalean-error: #dc2626;
  --skalean-text: #1f2937;
  --skalean-text-muted: #6b7280;
  --skalean-bg: #ffffff;
  --skalean-bg-alt: #f9fafb;
  --skalean-border: #e5e7eb;
}

body, .swagger-ui {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

.swagger-ui .topbar {
  background-color: var(--skalean-primary-dark) !important;
  border-bottom: 3px solid var(--skalean-primary-light);
}

.swagger-ui .topbar-wrapper .link {
  content: url('data:image/svg+xml;base64,${SKALEAN_LOGO_SVG_BASE64}');
}

.swagger-ui .info .title {
  color: var(--skalean-primary-dark);
  font-weight: 700;
}

.swagger-ui .scheme-container {
  background-color: var(--skalean-bg-alt);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.swagger-ui .opblock.opblock-get {
  background: rgba(176, 206, 226, 0.1);
  border-color: var(--skalean-primary);
}
.swagger-ui .opblock.opblock-get .opblock-summary-method {
  background: var(--skalean-primary);
}

.swagger-ui .opblock.opblock-post {
  background: rgba(16, 185, 129, 0.1);
  border-color: var(--skalean-success);
}
.swagger-ui .opblock.opblock-post .opblock-summary-method {
  background: var(--skalean-success);
}

.swagger-ui .opblock.opblock-put,
.swagger-ui .opblock.opblock-patch {
  background: rgba(245, 158, 11, 0.1);
  border-color: var(--skalean-warning);
}
.swagger-ui .opblock.opblock-put .opblock-summary-method,
.swagger-ui .opblock.opblock-patch .opblock-summary-method {
  background: var(--skalean-warning);
}

.swagger-ui .opblock.opblock-delete {
  background: rgba(220, 38, 38, 0.1);
  border-color: var(--skalean-error);
}
.swagger-ui .opblock.opblock-delete .opblock-summary-method {
  background: var(--skalean-error);
}

.swagger-ui .btn.authorize {
  background-color: var(--skalean-primary);
  color: white;
  border: none;
}
.swagger-ui .btn.authorize:hover {
  background-color: var(--skalean-primary-dark);
}

.swagger-ui .opblock-tag {
  font-weight: 600;
  color: var(--skalean-primary-dark);
}

.swagger-ui section.models {
  background-color: var(--skalean-bg-alt);
}

.swagger-ui select,
.swagger-ui input[type=text],
.swagger-ui textarea {
  border: 1px solid var(--skalean-border);
  border-radius: 4px;
}
`;

export const CUSTOM_FAVICON_BASE64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjNDM3ODlhIi8+PHRleHQgeD0iNCIgeT0iMTIiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSJ3aGl0ZSI+UzwvdGV4dD48L3N2Zz4=';
