/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-only packages that must not be bundled (native code or dynamic requires).
  serverExternalPackages: ['mongoose', 'sharp', 'cloudinary', 'nodemailer', 'sanitize-html', 'bcryptjs'],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // the admin screens must never be shown inside another site
        source: '/((?!api/public|api/files|api/health).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ];
  },
};

export default nextConfig;
