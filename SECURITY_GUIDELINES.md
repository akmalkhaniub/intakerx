# Security Guidelines & AI Agent Rules

This repository enforces strict security boundaries. All developers and AI assistants MUST adhere to the following rules:

## 1. Zero Hardcoded Credentials
* **Never** hardcode API keys (such as Google Gemini, Groq, Anthropic, or OpenAI keys), database passwords, or auth tokens directly in any source code, test script, or demo page.
* **Always** load credentials dynamically from environment variables:
  * In Node/TypeScript: Use `process.env.VARIABLE_NAME`.
  * In Python: Use `os.getenv("VARIABLE_NAME")` or `os.environ.get("VARIABLE_NAME")`.
  * In React/Vite: Use `import.meta.env.VITE_VARIABLE_NAME`.

## 2. Environment Variables & Fallbacks
* If a fallback value is necessary for local development:
  * Use generic local mock defaults (e.g. `postgresql://postgres:postgres@localhost:5432/dbname`).
  * For API keys, always default to an empty string (`""`) and raise a clear error if the variable is missing.
* Do not commit local `.env` files. Ensure they are listed in `.gitignore`.
* Keep `.env.example` updated with the names of all environment variables needed to run the application.

## 3. Git Operations
* **Always** inspect Git diffs (`git diff` or `git status`) and dry-run file additions (`git add --dry-run .`) before committing or pushing changes to remote repositories.
* Verify that new dependencies, logs, keys, or local config files are not accidentally staged.
