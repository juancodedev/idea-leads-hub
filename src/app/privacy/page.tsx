import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — IdeaLeadsHub",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground">Última actualización: 23 de julio de 2026</p>

        <h2>1. Responsable del Tratamiento</h2>
        <p>
          <strong>IdeaLeadsHub</strong> (en adelante, &ldquo;la aplicación&rdquo;) es un CRM personal operado por
          Juan Code. Esta política explica cómo recopilamos, usamos y protegemos tu información cuando
          utilizas la aplicación y servicios asociados, incluyendo la integración con Instagram.
        </p>

        <h2>2. Datos que Recopilamos</h2>
        <h3>2.1 Datos proporcionados por el usuario</h3>
        <ul>
          <li>Correo electrónico y contraseña (para autenticación)</li>
          <li>Nombre, empresa y otra información de contacto de leads</li>
          <li>Notas, actividades y seguimiento de interacciones comerciales</li>
        </ul>

        <h3>2.2 Datos de Instagram</h3>
        <p>
          Cuando conectas tu cuenta de Instagram Business a la aplicación, recopilamos:
        </p>
        <ul>
          <li>Mensajes directos enviados y recibidos a través de Instagram</li>
          <li>Identificador de Instagram (Instagram Scoped ID) de los remitentes</li>
          <li>Metadatos de los mensajes (marcas de tiempo, tipo de mensaje)</li>
        </ul>

        <h3>2.3 Datos técnicos</h3>
        <ul>
          <li>Dirección IP (incluida en las solicitudes de webhook de Meta)</li>
          <li>Registros de actividad del sistema para diagnóstico y seguridad</li>
        </ul>

        <h2>3. Finalidad del Tratamiento</h2>
        <p>Utilizamos tus datos para:</p>
        <ul>
          <li>Gestionar tu cuenta y autenticación</li>
          <li>Centralizar mensajes de Instagram en tu CRM personal</li>
          <li>Crear y gestionar leads, actividades y seguimiento comercial</li>
          <li>Mejorar la aplicación y diagnosticar problemas técnicos</li>
          <li>Cumplir con obligaciones legales aplicables</li>
        </ul>

        <h2>4. Base Legal</h2>
        <p>
          El tratamiento de tus datos se basa en:
        </p>
        <ul>
          <li><strong>Ejecución de un contrato:</strong> proporcionar el servicio CRM que solicitaste</li>
          <li><strong>Consentimiento:</strong> al conectar tu cuenta de Instagram y aceptar esta política</li>
          <li><strong>Interés legítimo:</strong> mejora y seguridad del servicio</li>
        </ul>

        <h2>5. Compartición de Datos</h2>
        <p>No vendemos tus datos personales. Compartimos datos únicamente con:</p>
        <ul>
          <li><strong>Meta Platforms, Inc.</strong> — para recibir mensajes de Instagram a través de sus webhooks y API</li>
          <li><strong>Supabase Inc.</strong> — como proveedor de infraestructura de base de datos</li>
          <li><strong>Cloudflare Inc.</strong> — como proveedor de hosting y red de entrega</li>
        </ul>
        <p>
          Estos proveedores actúan como encargados del tratamiento y están sujetos a acuerdos de
          confidencialidad que cumplen con el RGPD y otras normativas aplicables.
        </p>

        <h2>6. Conservación de Datos</h2>
        <p>
          Conservamos tus datos mientras mantengas una cuenta activa. Los mensajes de Instagram y
          datos asociados se conservan hasta que elimines tu cuenta o solicites su eliminación.
          Los registros técnicos se conservan por un máximo de 90 días.
        </p>

        <h2>7. Tus Derechos</h2>
        <p>Tienes derecho a:</p>
        <ul>
          <li>Acceder a tus datos personales</li>
          <li>Solicitar la rectificación de datos inexactos</li>
          <li>Solicitar la eliminación de tus datos</li>
          <li>Limitar u oponerte al tratamiento</li>
          <li>Portar tus datos a otro servicio</li>
          <li>Retirar tu consentimiento en cualquier momento</li>
        </ul>
        <p>
          Para ejercer estos derechos, contacta a través del correo electrónico indicado en la
          sección 9.
        </p>

        <h2>8. Seguridad</h2>
        <p>
          Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo:
          cifrado en tránsito (TLS), cifrado en reposo, autenticación segura mediante Supabase
          Auth, y verificación HMAC de solicitudes entrantes de webhook.
        </p>

        <h2>9. Contacto</h2>
        <p>
          Para cualquier consulta sobre esta política de privacidad o el tratamiento de tus datos,
          puedes contactar a:
        </p>
        <ul>
          <li>Correo: <a href="mailto:juan@juancode.dev">juan@juancode.dev</a></li>
          <li>Sitio web: <a href="https://juancode.dev">juancode.dev</a></li>
        </ul>

        <h2>10. Cambios en esta Política</h2>
        <p>
          Podemos actualizar esta política periódicamente. Te notificaremos de cambios
          sustanciales a través de la aplicación o por correo electrónico. El uso continuado
          del servicio tras los cambios constituye la aceptación de la política actualizada.
        </p>

        <hr className="my-8" />
        <p className="text-xs text-muted-foreground">
          Esta política de privacidad cumple con el Reglamento General de Protección de Datos
          (RGPD / GDPR) de la Unión Europea y la Ley de Servicios Digitales (DSA) aplicable.
        </p>
      </div>
    </div>
  );
}
