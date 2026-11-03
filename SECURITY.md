# Security and privacy

DemoPilot executes explicit browser actions on the website in a recipe. Treat recipes as instructions that may change the target app. Review imported URLs, actions and values before recording. Use only authorized apps and synthetic data; don't run an untrusted recipe against a signed-in production system.

Studio is a **local tool**, not an internet service. It binds to 127.0.0.1, checks Host/Origin and requires a session token for mutations. Do not bypass these checks, forward its port publicly, or place it behind a shared proxy. Local processes on the same machine are trusted; this is not a multi-user isolation boundary.

The browser uses a fresh context. DemoPilot does not reuse personal cookies, capture audio, send analytics or upload videos. Websites and package/browser installation can make network requests. Page content and form values may appear in recordings, posters, downloaded recipes and local draft storage. Password filling is rejected; existing visible secrets are not automatically redacted.

Successful footage remains under `.demopilot` until you remove it. Do not publish the data directory. Only deliberately share the synthetic sample media or reviewed final exports. The `.gitignore` excludes runtime data, dependencies, environment files and test evidence.

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/Ray0766/demopilot/security/advisories/new) if available. If private reporting is unavailable, open an issue asking for a private contact method without publishing exploit details or private recordings. Never include credentials or personal footage in a public report.
