'use client';

import { useEffect } from 'react';

export default function ApiDocs() {
  useEffect(() => {
    // Dynamically load Swagger UI scripts from CDN
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          // @ts-ignore
          window.SwaggerUIBundle.presets.apis,
          // @ts-ignore
          window.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <div id="swagger-ui"></div>
    </div>
  );
}
