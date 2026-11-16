//! ForbeCORP: zero-dependency Rust static-site generator and local preview server.
//! Production deployment: upload `dist/` to a static host with HTTPS and compression.
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

const LANGUAGES: &[(&str, &str)] = &[
    ("en", "English"),
    ("es", "Español"),
    ("fr", "Français"),
    ("de", "Deutsch"),
    ("pt", "Português"),
    ("ru", "Русский"),
    ("zh-CN", "简体中文"),
    ("ar", "العربية"),
    ("hi", "हिन्दी"),
    ("ja", "日本語"),
    ("ko", "한국어"),
    ("it", "Italiano"),
    ("id", "Bahasa Indonesia"),
    ("tr", "Türkçe"),
    ("bn", "বাংলা"),
];

struct Tool {
    slug: &'static str,
    icon: &'static str,
    category: &'static str,
    featured: bool,
    title: &'static str,
    description: &'static str,
    guide: &'static str,
    scripts: &'static [&'static str],
}

const TOOLS: &[Tool] = &[
    Tool {
        slug: "pdf-to-text",
        icon: "PDF",
        category: "pdf",
        featured: true,
        title: "pdfTextTitle",
        description: "pdfTextIntro",
        guide: "pdfTextGuide",
        scripts: &["documents.js", "pdf-tools.js"],
    },
    Tool {
        slug: "text-cleaner",
        icon: "↵",
        category: "text",
        featured: true,
        title: "cleanTitle",
        description: "cleanIntro",
        guide: "cleanerGuide",
        scripts: &["documents.js", "text-tools.js"],
    },
    Tool {
        slug: "text-compare",
        icon: "±",
        category: "text",
        featured: true,
        title: "comparePageTitle",
        description: "compareIntro",
        guide: "compareGuide",
        scripts: &["documents.js", "pdf-tools.js", "extra-tools.js"],
    },
    Tool {
        slug: "humanizer",
        icon: "Aa",
        category: "text",
        featured: true,
        title: "rewriteTitle",
        description: "rewriteIntro",
        guide: "rewriteGuide",
        scripts: &["documents.js", "text-tools.js"],
    },
    Tool {
        slug: "text-counter",
        icon: "#",
        category: "text",
        featured: true,
        title: "toolTextTitle",
        description: "counterIntro",
        guide: "counterGuide",
        scripts: &["text-tools.js"],
    },
    Tool {
        slug: "ocr",
        icon: "OCR",
        category: "pdf",
        featured: true,
        title: "ocrTitle",
        description: "ocrIntro",
        guide: "ocrGuide",
        scripts: &["documents.js", "pdf-tools.js"],
    },
    Tool {
        slug: "ai-detector",
        icon: "¶",
        category: "text",
        featured: false,
        title: "detectorTitle",
        description: "detectorIntro",
        guide: "styleAdvice",
        scripts: &["documents.js", "text-tools.js"],
    },
    Tool {
        slug: "pdf-pages",
        icon: "1·2",
        category: "pdf",
        featured: false,
        title: "pdfPagesTitle",
        description: "pdfPagesIntro",
        guide: "pdfPagesGuide",
        scripts: &["pdf-tools.js"],
    },
    Tool {
        slug: "document-to-text",
        icon: "TXT",
        category: "data",
        featured: false,
        title: "docTitle",
        description: "docIntro",
        guide: "docGuide",
        scripts: &["documents.js", "pdf-tools.js", "extra-tools.js"],
    },
    Tool {
        slug: "table-tools",
        icon: "CSV",
        category: "data",
        featured: false,
        title: "tableTitle",
        description: "tableIntro",
        guide: "tableGuide",
        scripts: &["extra-tools.js"],
    },
    Tool {
        slug: "markdown-preview",
        icon: "MD",
        category: "text",
        featured: false,
        title: "markdownTitle",
        description: "markdownIntro",
        guide: "markdownGuide",
        scripts: &["extra-tools.js"],
    },
    Tool {
        slug: "image-tools",
        icon: "IMG",
        category: "image",
        featured: false,
        title: "imageTitle",
        description: "imageIntro",
        guide: "imageGuide",
        scripts: &["extra-tools.js"],
    },
    Tool {
        slug: "batch-tools",
        icon: "ZIP",
        category: "data",
        featured: false,
        title: "batchTitle",
        description: "batchIntro",
        guide: "batchGuide",
        scripts: &["documents.js", "pdf-tools.js", "extra-tools.js"],
    },
];

const CATEGORIES: &[(&str, &str)] = &[
    ("text", "categoryText"),
    ("pdf", "categoryPdf"),
    ("data", "categoryData"),
    ("image", "categoryImage"),
];

#[derive(Default)]
struct Site {
    origin: Option<String>,
    google_verification: Option<String>,
}

impl Site {
    fn from_environment() -> Result<Self, String> {
        let origin = env::var("FORBECORP_SITE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(|value| normalize_origin(&value))
            .transpose()?;
        let google_verification = env::var("FORBECORP_GOOGLE_SITE_VERIFICATION")
            .ok()
            .filter(|value| !value.is_empty());
        if let Some(token) = &google_verification {
            if origin.is_none()
                || !token
                    .bytes()
                    .all(|char| char.is_ascii_alphanumeric() || b"-_".contains(&char))
            {
                return Err("Search Console verification needs a public site URL and a valid verification token.".into());
            }
        }
        Ok(Self {
            origin,
            google_verification,
        })
    }

    fn route(&self, prefix: &str, locale: &str, suffix: &str) -> String {
        if let Some(origin) = &self.origin {
            format!("{origin}/{locale}/{suffix}")
        } else {
            format!("{prefix}{locale}/{suffix}")
        }
    }

    fn index(&self) -> &str {
        if self.origin.is_some() {
            ""
        } else {
            "index.html"
        }
    }
}

fn normalize_origin(input: &str) -> Result<String, String> {
    let invalid = || {
        "FORBECORP_SITE_URL must be a public HTTPS origin such as https://example.com.".to_string()
    };
    let input = input.trim();
    let host_port = input.strip_prefix("https://").ok_or_else(invalid)?;
    let host_port = host_port.strip_suffix('/').unwrap_or(host_port);
    let host = if let Some((host, port)) = host_port.split_once(':') {
        if port
            .parse::<u16>()
            .ok()
            .filter(|value| *value != 0)
            .is_none()
        {
            return Err(invalid());
        }
        host
    } else {
        host_port
    };
    if !host.contains('.')
        || host.len() > 253
        || host.split('.').any(|label| {
            label.is_empty()
                || label.len() > 63
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|char| char.is_ascii_alphanumeric() || char == b'-')
        })
    {
        return Err(invalid());
    }
    Ok(format!("https://{}", host_port.to_ascii_lowercase()))
}

fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn get_text(map: &BTreeMap<String, String>, key: &str) -> Result<String, String> {
    map.get(key)
        .map(|value| escape_html(value))
        .ok_or_else(|| format!("Required translation is missing: {key}"))
}

fn load_locale(file: &Path) -> Result<BTreeMap<String, String>, String> {
    let content = fs::read_to_string(file).map_err(|e| format!("{}: {e}", file.display()))?;
    let mut map = BTreeMap::new();
    for (i, line) in content.lines().enumerate() {
        if line.trim().is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = line
            .split_once('\t')
            .ok_or_else(|| format!("{} line {} needs a tab separator", file.display(), i + 1))?;
        if key.is_empty() || value.is_empty() || map.insert(key.into(), value.into()).is_some() {
            return Err(format!(
                "{} line {} has empty or duplicate key",
                file.display(),
                i + 1
            ));
        }
    }
    Ok(map)
}

fn language_options(current: &str) -> String {
    LANGUAGES
        .iter()
        .map(|(code, name)| {
            let selected = if *code == current { " selected" } else { "" };
            let dir = if *code == "ar" { "rtl" } else { "ltr" };
            format!(
                "<option value=\"{code}\" lang=\"{code}\" dir=\"{dir}\"{selected}>{}</option>",
                escape_html(name)
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn alternates(site: &Site, prefix: &str, suffix: &str) -> String {
    let mut links = String::new();
    for (code, _) in LANGUAGES {
        let href = site.route(prefix, code, suffix);
        links.push_str(&format!(
            "<link rel=\"alternate\" hreflang=\"{code}\" href=\"{href}\">\n"
        ));
    }
    let fallback = site.route(prefix, "en", suffix);
    links.push_str(&format!(
        "<link rel=\"alternate\" hreflang=\"x-default\" href=\"{fallback}\">\n"
    ));
    links
}

fn tool_card(map: &BTreeMap<String, String>, tool: &Tool, index: &str) -> Result<String, String> {
    let (slug, category) = (tool.slug, tool.category);
    let aliases = map
        .get(&format!("search-{slug}"))
        .map(|text| escape_html(text))
        .unwrap_or_default();
    Ok(format!(
        r#"<article class="tool-card glass is-ready" data-catalog-tool="{slug}" data-category="{category}" data-search="{guide}">
      <div class="tool-card-top"><span class="tool-icon" aria-hidden="true">{icon}</span></div>
      <h4 id="card-{slug}">{title}</h4><p>{description}</p>
      <a class="tool-action btn btn-secondary" data-route href="./{slug}/{index}" aria-labelledby="open-{slug} card-{slug}"><span id="open-{slug}">{action}</span> <span aria-hidden="true">&#8599;</span></a>
    </article>"#,
        guide = format!("{} {aliases}", get_text(map, tool.guide)?),
        icon = escape_html(tool.icon),
        title = get_text(map, tool.title)?,
        description = get_text(map, tool.description)?,
        action = get_text(map, "toolOpen")?
    ))
}

fn catalog(map: &BTreeMap<String, String>, site: &Site) -> Result<String, String> {
    let mut sections = Vec::new();
    let sections_in_order =
        std::iter::once(("featured", "featuredTools")).chain(CATEGORIES.iter().copied());
    for (group, title) in sections_in_order {
        let selected = TOOLS.iter().filter(|tool| {
            (group == "featured" && tool.featured) || (!tool.featured && tool.category == group)
        });
        let cards = selected
            .map(|tool| tool_card(map, tool, site.index()))
            .collect::<Result<Vec<_>, _>>()?;
        if cards.is_empty() {
            continue;
        }
        let title = get_text(map, title)?;
        sections.push(format!(
            r#"<section class="catalog-group" data-catalog-group aria-labelledby="group-{group}">
          <h3 id="group-{group}">{title}</h3>
          <div class="tools-grid">{}</div>
        </section>"#,
            cards.join("\n")
        ));
    }
    Ok(sections.join("\n"))
}

fn tool_messages(map: &BTreeMap<String, String>) -> String {
    let mut html = String::from("<div id=\"tool-strings\" hidden");
    for (name, key) in [
        ("data-msg-copied", "rewriteCopied"),
        ("data-msg-copy-error", "rewriteCopyError"),
        ("data-msg-transfer-error", "transferError"),
    ] {
        if let Some(value) = map.get(key) {
            html.push_str(&format!(" {name}=\"{}\"", escape_html(value)));
        }
    }
    for (key, value) in map.iter().filter(|(key, _)| key.starts_with("msg")) {
        let mut attr = String::from("data-");
        for char in key.chars() {
            if char.is_ascii_uppercase() {
                attr.push('-');
            }
            attr.push(char.to_ascii_lowercase());
        }
        html.push_str(&format!(" {attr}=\"{}\"", escape_html(value)));
    }
    html.push_str("></div>");
    html
}

fn render(
    site: &Site,
    locale: &str,
    template: &str,
    content: &str,
    tool: Option<&Tool>,
    dict: &BTreeMap<String, String>,
) -> Result<String, String> {
    let (body, prefix, suffix, home, scripts, messages) = if let Some(tool) = tool {
        let index = site.index();
        let guide = get_text(dict, tool.guide)?;
        let body = format!(
            r#"<div class="main-with-ads tool-page">
<div aria-hidden="true" class="ad-slot" id="ad-slot-start"></div>
<div class="main-content"><div class="section tool-shell"><div class="container">
<a class="tool-back" href="../{index}#tools" data-route><span aria-hidden="true">‹</span> {{{{navTools}}}}</a>
{content}
<details class="tool-guide glass"><summary>{{{{howItWorks}}}}</summary><p>{guide}</p></details>
</div></div></div>
<div aria-hidden="true" class="ad-slot" id="ad-slot-end"></div>
</div>"#
        );
        let scripts = ["tools-core.js", "workflow.js"]
            .into_iter()
            .chain(tool.scripts.iter().copied())
            .map(|script| format!("<script defer src=\"../../assets/{script}\"></script>\n"))
            .collect::<String>();
        (
            body,
            "../../",
            format!("{}/", tool.slug),
            format!("../{index}"),
            scripts,
            tool_messages(dict),
        )
    } else {
        (
            content.replace("{{toolCards}}", &catalog(dict, site)?),
            "../",
            String::new(),
            String::new(),
            String::new(),
            tool_messages(dict),
        )
    };
    let mut page = template.replace("{{bodyContent}}", &body);
    if let Some(tool) = tool {
        page = page
            .replace(
                "{{metaTitle}}",
                &format!("{} · ForbeCORP", get_text(dict, tool.title)?),
            )
            .replace("{{metaDescription}}", &get_text(dict, tool.description)?);
    }
    for (key, value) in dict {
        page = page.replace(&format!("{{{{{key}}}}}"), &escape_html(value));
    }
    let verification = site
        .google_verification
        .as_ref()
        .map(|token| format!("<meta name=\"google-site-verification\" content=\"{token}\">\n"))
        .unwrap_or_default();
    let replacements = [
        ("{{lang}}", locale.to_string()),
        ("{{toolSlug}}", tool.map_or("", |tool| tool.slug).into()),
        ("{{home}}", home),
        ("{{assetRoot}}", format!("{prefix}assets/")),
        (
            "{{dir}}",
            if locale == "ar" {
                "rtl".into()
            } else {
                "ltr".into()
            },
        ),
        ("{{languageOptions}}", language_options(locale)),
        ("{{alternateLinks}}", alternates(site, prefix, &suffix)),
        ("{{canonical}}", site.route(prefix, locale, &suffix)),
        ("{{verification}}", verification),
        ("{{toolScripts}}", scripts),
        ("{{toolMessages}}", messages),
        ("{{routeIndex}}", site.index().into()),
        ("{{year}}", "2026".into()),
    ];
    for (marker, value) in replacements {
        page = page.replace(marker, &value);
    }
    if let Some(start) = page.find("{{") {
        let unresolved: String = page[start..].chars().take(56).collect();
        return Err(format!(
            "Unresolved template placeholder in {locale} ({}): {unresolved}",
            tool.map_or("home", |tool| tool.slug)
        ));
    }
    Ok(page)
}

fn copy_assets(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::create_dir_all(destination)?;
    for item in fs::read_dir(source)? {
        let item = item?;
        let kind = item.file_type()?;
        let output = destination.join(item.file_name());
        if kind.is_dir() {
            copy_assets(&item.path(), &output)?;
        } else if kind.is_file() {
            fs::copy(item.path(), output)?;
        }
    }
    Ok(())
}

fn validated_catalog_locale(
    folder: &Path,
    locale: &str,
    expected: &BTreeSet<String>,
) -> Result<BTreeMap<String, String>, String> {
    let dict = load_locale(&folder.join(format!("{locale}.tsv")))?;
    if dict.keys().cloned().collect::<BTreeSet<_>>() != *expected {
        return Err(format!(
            "Translation keys don't match for {locale} in {}",
            folder.display()
        ));
    }
    Ok(dict)
}

fn page_paths() -> impl Iterator<Item = (&'static str, String)> {
    LANGUAGES.iter().flat_map(|(locale, _)| {
        std::iter::once((*locale, String::new())).chain(
            TOOLS
                .iter()
                .map(move |tool| (*locale, format!("{}/", tool.slug))),
        )
    })
}

fn sitemap(site: &Site) -> String {
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
    for (locale, suffix) in page_paths() {
        let url = site.route("", locale, &suffix);
        xml.push_str(&format!("  <url><loc>{url}</loc></url>\n"));
    }
    xml.push_str("</urlset>\n");
    xml
}

fn build(project: &Path) -> Result<PathBuf, String> {
    let site = Site::from_environment()?;
    let read_template = |name: &str| {
        fs::read_to_string(project.join("templates").join(name))
            .map_err(|e| format!("Cannot read HTML template {name}: {e}"))
    };
    let template = read_template("index.html")?;
    let home = read_template("home.html")?;
    let tool_templates = TOOLS
        .iter()
        .map(|tool| read_template(&format!("tools/{}.html", tool.slug)))
        .collect::<Result<Vec<_>, _>>()?;
    let dist = project.join("dist");
    let locale_root = project.join("locales");
    let folders = [
        locale_root.clone(),
        locale_root.join("workspace"),
        locale_root.join("expansion"),
    ];
    let keys = folders
        .iter()
        .map(|folder| load_locale(&folder.join("en.tsv")).map(|map| map.into_keys().collect()))
        .collect::<Result<Vec<BTreeSet<_>>, _>>()?;
    copy_assets(&project.join("assets"), &dist.join("assets")).map_err(|e| e.to_string())?;
    for (locale, _) in LANGUAGES {
        let mut dict = BTreeMap::new();
        for (folder, expected) in folders.iter().zip(&keys) {
            dict.extend(validated_catalog_locale(folder, locale, expected)?);
        }
        let dir = dist.join(locale);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(
            dir.join("index.html"),
            render(&site, locale, &template, &home, None, &dict)?,
        )
        .map_err(|e| e.to_string())?;
        for (tool, content) in TOOLS.iter().zip(&tool_templates) {
            let route = dir.join(tool.slug);
            fs::create_dir_all(&route).map_err(|e| e.to_string())?;
            fs::write(
                route.join("index.html"),
                render(&site, locale, &template, content, Some(tool), &dict)?,
            )
            .map_err(|e| e.to_string())?;
        }
    }
    let root_canonical = site
        .origin
        .as_ref()
        .map(|origin| format!("<link rel=\"canonical\" href=\"{origin}/en/\">\n"))
        .unwrap_or_default();
    let site_verification = site
        .google_verification
        .as_ref()
        .map(|token| format!("<meta name=\"google-site-verification\" content=\"{token}\">\n"))
        .unwrap_or_default();
    let language_codes = LANGUAGES
        .iter()
        .map(|(code, _)| format!("'{code}'"))
        .collect::<Vec<_>>()
        .join(",");
    let index = site.index();
    fs::write(dist.join("index.html"), format!(r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ForbeCORP · Language</title>
{root_canonical}{site_verification}<script>(function(){{const allowed=[{language_codes}];let lang='en';try{{const saved=localStorage.getItem('forbecorp-language');if(allowed.includes(saved))lang=saved}}catch(_){{}}const index=location.protocol==='file:'?'index.html':'';location.replace('./'+lang+'/'+index+location.search+location.hash)}})()</script>
<noscript><meta http-equiv="refresh" content="0; url=./en/{index}"></noscript></head>
<body><p><a href="./en/{index}">Continue to ForbeCORP (English)</a></p></body></html>"#))
        .map_err(|e| e.to_string())?;
    let mut robots = "User-agent: *\nAllow: /\n".to_owned();
    let sitemap_file = dist.join("sitemap.xml");
    if let Some(origin) = &site.origin {
        fs::write(&sitemap_file, sitemap(&site)).map_err(|e| e.to_string())?;
        robots.push_str(&format!("Sitemap: {origin}/sitemap.xml\n"));
    } else if let Err(error) = fs::remove_file(&sitemap_file) {
        if error.kind() != std::io::ErrorKind::NotFound {
            return Err(error.to_string());
        }
    }
    fs::write(dist.join("robots.txt"), robots).map_err(|e| e.to_string())?;
    Ok(dist)
}

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|x| x.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("xml") => "application/xml; charset=utf-8",
        Some("wasm") => "application/wasm",
        Some("png") => "image/png",
        Some("pdf") => "application/pdf",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn response(stream: &mut TcpStream, status: &str, content_type: &str, cache: &str, body: &[u8]) {
    let header = format!("HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nCache-Control: {cache}\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n", body.len());
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
}

fn safe_path(url_path: &str) -> Option<PathBuf> {
    let path = url_path.split('?').next()?;
    if !path.starts_with('/') || path.contains('%') || path.contains('\\') || path.contains('\0') {
        return None;
    }
    let mut result = PathBuf::new();
    for segment in path.split('/') {
        if segment.is_empty() {
            continue;
        }
        if segment.ends_with('.')
            || !segment
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
        {
            return None;
        }
        result.push(segment);
    }
    if path.ends_with('/') || result.as_os_str().is_empty() {
        result.push("index.html");
    }
    Some(result)
}

fn serve_connection(mut stream: TcpStream, dist: &Path) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut buf = [0u8; 8192];
    let n = match stream.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return,
    };
    let request = String::from_utf8_lossy(&buf[..n]);
    let mut parts = request.lines().next().unwrap_or("").split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    if method != "GET" {
        response(
            &mut stream,
            "405 Method Not Allowed",
            "text/plain",
            "no-store",
            b"Only GET is supported",
        );
        return;
    }
    let Some(relative) = safe_path(path) else {
        response(
            &mut stream,
            "400 Bad Request",
            "text/plain",
            "no-store",
            b"Invalid path",
        );
        return;
    };
    let file = dist.join(relative);
    if file.is_dir() {
        let location = file
            .strip_prefix(dist)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        let _ = write!(stream, "HTTP/1.1 308 Permanent Redirect\r\nLocation: /{location}/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        return;
    }
    match fs::read(&file) {
        Ok(bytes) => {
            response(
                &mut stream,
                "200 OK",
                content_type(&file),
                "no-cache",
                &bytes,
            );
        }
        Err(_) => response(
            &mut stream,
            "404 Not Found",
            "text/plain",
            "no-store",
            b"Page not found",
        ),
    }
}

fn main() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut args = env::args().skip(1);
    let command = args.next().unwrap_or_else(|| "serve".to_string());
    match command.as_str() {
        "build" => match build(&root) {
            Ok(path) => println!(
                "Generated {} localized static pages in {}",
                LANGUAGES.len() * (TOOLS.len() + 1),
                path.display()
            ),
            Err(message) => {
                eprintln!("Build failed: {message}");
                std::process::exit(1);
            }
        },
        "serve" => {
            let dist = build(&root).unwrap_or_else(|e| {
                eprintln!("Build failed: {e}");
                std::process::exit(1)
            });
            let port: u16 = args
                .next()
                .unwrap_or_else(|| "8080".into())
                .parse()
                .expect("Port must be an integer, for example 8080");
            let listener =
                TcpListener::bind(("127.0.0.1", port)).expect("Could not open local listener");
            println!("ForbeCORP preview: http://127.0.0.1:{port}/en/");
            for stream in listener.incoming().flatten() {
                let dist = dist.clone();
                std::thread::spawn(move || serve_connection(stream, &dist));
            }
        }
        _ => {
            eprintln!("Usage: cargo run --release -- [build | serve [PORT]]");
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn escapes_untrusted_text() {
        assert_eq!(escape_html("<&\"'"), "&lt;&amp;&quot;&#39;");
    }
    #[test]
    fn rejects_traversal() {
        assert!(safe_path("/../etc/passwd").is_none());
        assert!(safe_path("/en/%2e%2e/").is_none());
        assert_eq!(safe_path("/en/").unwrap(), PathBuf::from("en/index.html"));
    }
    #[test]
    fn all_15_locales_defined() {
        assert_eq!(LANGUAGES.len(), 15);
    }

    #[test]
    fn sitemap_uses_production_routes_for_every_tool_and_language() {
        let site = Site {
            origin: Some("https://example.com".into()),
            ..Site::default()
        };
        let sitemap = sitemap(&site);
        assert_eq!(
            sitemap.matches("<loc>").count(),
            LANGUAGES.len() * (TOOLS.len() + 1)
        );
        assert!(sitemap.contains("<loc>https://example.com/ja/pdf-to-text/</loc>"));
        assert!(!sitemap.contains("index.html"));
        let urls = alternates(&site, "../../", "text-compare/");
        assert!(urls.contains("hreflang=\"ar\" href=\"https://example.com/ar/text-compare/\""));
    }

    #[test]
    fn public_url_is_an_https_origin_only() {
        assert_eq!(
            normalize_origin("https://Example.COM/").unwrap(),
            "https://example.com"
        );
        for invalid in [
            "http://example.com",
            "https://example.com/blog",
            "https://user@example.com",
            "https://example.com?x=1",
            "https://example.com:0",
        ] {
            assert!(normalize_origin(invalid).is_err(), "accepted {invalid}");
        }
        assert!(safe_path("/x/C:secret").is_none());
        assert!(safe_path("/ru/...").is_none());
    }
}
