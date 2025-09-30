/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",           // когато някой отвори основния домейн
        destination: "/book",  // пренасочва към /book
        permanent: true,       // ако е true → 308 redirect (SEO-friendly)
      },
    ];
  },
};

module.exports = nextConfig;
