import type { NextConfig } from "next"

const isGithubPages = process.env.GITHUB_PAGES === "true"

const nextConfig: NextConfig = isGithubPages
  ? {
      output: "export",
      basePath: "/lkre",
      assetPrefix: "/lkre/",
      images: { unoptimized: true },
      trailingSlash: true,
    }
  : {}

export default nextConfig
