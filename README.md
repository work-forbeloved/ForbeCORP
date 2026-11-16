# ForbeCORP

ForbeCORP is a static site with a searchable catalogue and 13 browser tools in 15 languages. Rust generates 210 localized pages. The landing page and core text tools use native HTML, CSS and JavaScript. PDF, OCR, ZIP and Markdown engines are loaded only by the operations that need them.

## Run locally

Install stable Rust from <https://rustup.rs/> and run the following in the project directory:

```powershell
cargo run --release -- serve 8080
```

Open <http://127.0.0.1:8080/>. Browser workers and bundled libraries use HTTP, so use the preview server for PDF, OCR, comparison and ZIP operations. The server binds to loopback for development. Deploy the generated `dist/` folder for production.

## Tools

- **PDF and OCR.** Select pages, extract selectable text, recognize scanned pages and images in the 15 supported languages, and merge, reorder, rotate or split PDFs. Text extraction reads the PDF text layer. OCR reconstructs text from pixels, so review complex layouts, handwriting and low-resolution scans.
- **Text.** Clean up line breaks, spaces and duplicates, sort lines, change case, and apply literal replacements. Count text and estimate reading and speaking time, compare document versions, check style, and review or undo suggested edits before saving TXT or DOCX.
- **Documents, data and images.** Extract text from document files, preview or convert CSV and Markdown, compress or resize JPG, PNG and WebP, and batch-process files into a ZIP archive.

File contents are processed inside the browser. Bundled engines and OCR language models are served from the same origin. Text transfers use session storage until the next tool opens. Saving cleanup settings stores options only and applies them to batch text cleanup. There is no account or analytics requirement for using these tools.

## Build for a public domain

Set `FORBECORP_SITE_URL` to the real HTTPS origin of the site. For example:

```powershell
$env:FORBECORP_SITE_URL = 'https://forbecorp.example'
cargo run --release -- build
```

This produces absolute canonical and `hreflang` URLs for the 210 localized pages, a `sitemap.xml`, and its entry in `robots.txt`. Serve directories at their trailing-slash URLs and configure HTTPS and compression on the host. A build with `FORBECORP_SITE_URL` unset uses relative links and clears any generated production sitemap.

After publication, add the domain or URL-prefix property in [Google Search Console](https://search.google.com/search-console/) and submit `/sitemap.xml`. If you select the HTML meta-tag verification method for a URL-prefix property, set `FORBECORP_GOOGLE_SITE_VERIFICATION` to the token from Google and rebuild. The token is optional. Desktop ad space is reserved for a future placement on wide screens.

## Work on the project

- `src/main.rs` defines routes, categories and static-site generation.
- `templates/home.html` and `templates/tools/` contain the catalogue and tool layouts.
- `assets/` contains browser code, examples and the vendored libraries. See `assets/vendor/README.md` for package versions and integrity hashes.
- `locales/*.tsv`, `locales/workspace/*.tsv` and `locales/expansion/*.tsv` contain the interface text. Every folder validates that it has the same keys for all 15 languages.

Run `cargo test` for generator and routing checks and `cargo run --release -- build` to validate the templates and generate the site.
