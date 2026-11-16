# ForbeCORP

## Run locally

Install stable Rust from <https://rustup.rs/> and run the following in the project directory:

```powershell
cargo run --release -- serve 8080
```

Open <http://127.0.0.1:8080/>. Browser workers and bundled libraries use HTTP, so use the preview server for PDF, OCR, comparison and ZIP operations. The server binds to loopback for development. Deploy the generated `dist/` folder for production.

Set `FORBECORP_SITE_URL` to the real HTTPS origin of the site. For example:

```powershell
$env:FORBECORP_SITE_URL = 'https://forbecorp.example'
cargo run --release -- build
```
