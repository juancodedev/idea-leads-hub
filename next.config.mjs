/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages specific config if needed
  // For example, if using images from external domains:
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
