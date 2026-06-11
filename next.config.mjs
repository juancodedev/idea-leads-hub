/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Las reglas de lint se verifican con "next lint" por separado.
    // Durante el build se ignoran para no bloquear por issues pre-existentes.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
