# Third-party notices

DemoPilot's own source, sample app and synthetic sample media are MIT licensed. Third-party licenses are independent and remain in their packages.

| Component | Role | License |
| --- | --- | --- |
| Playwright | Chromium automation/recording | Apache-2.0 |
| Express, Commander, Zod | Local server, CLI, validation | MIT |
| React, React DOM | Studio UI | MIT |
| Lucide | Interface icons | ISC |
| Sharp | Rasterizing original SVG frames | Apache-2.0; bundled native libraries have additional notices |
| Vite, TypeScript, tsx | Build/development | MIT / Apache-2.0 / MIT |

FFmpeg and ffprobe are **external prerequisites**, not redistributed in the DemoPilot release. Their license depends on how they are built; libx264-enabled builds generally include GPL components. See [FFmpeg legal information](https://ffmpeg.org/legal.html). Playwright downloads its own browsers and recording helper; their bundled notices apply. The application license does not relicense these executables.

Studio bundles Bricolage Grotesque and DM Sans, both under SIL Open Font License 1.1. Exact Fontsource package versions, archive integrity and asset hashes are recorded in [public/fonts/SOURCES.json](public/fonts/SOURCES.json); complete licenses are beside the WOFF2 files and copied to the built client. CJK text and exported captions use installed fonts. No stock photos, third-party logos or product screenshots are bundled as design assets. The logo SVG and Littleboard sample were created for this project. Design references are linked in docs/DECISIONS.md and docs/UI-COMPOSITION.md for discussion only. Remotion and Screen Studio are not dependencies.
