use std::path::{Path, PathBuf};
use tinymist_std::error::prelude::*;

use reflexo_typst::{Bytes, TypstPagedDocument};
use typst::layout::{Page, PageRanges};

/// An image format to export in.
#[derive(Clone, Copy)]
pub enum ImageExportFormat {
    Png,
    Svg,
}

pub struct CompileConfig {
    /// Output path.
    pub output: PathBuf,
    /// Pages to export (1-based).
    pub pages: Option<PageRanges>,
    /// Pixels per inch.
    pub ppi: f32,
}

pub struct ExportedPage {
    /// 0-based index of the page in the document.
    pub index: usize,
    /// The path where the image is stored. It can be regared as failure if two pages have the same path in multipage export.
    pub path: PathBuf,
    /// The image data.
    pub bytes: Bytes,
}

pub struct CompileConfig2 {
    /// Pages to export (1-based).
    pub pages: Option<PageRanges>,
    /// Pixels per inch.
    pub ppi: f32,
}

pub struct ExportedPage2 {
    /// 0-based index of the page in the document.
    pub index: usize,
    /// The image data.
    pub bytes: Bytes,
}

/// Export to one or multiple images.
pub fn export_image_2(
    document: &TypstPagedDocument,
    config: &CompileConfig2,
    fmt: ImageExportFormat,
) -> Result<Vec<ExportedPage2>> {
    document
        .pages
        .iter()
        .enumerate()
        .filter(|(i, _)| {
            config.pages.as_ref().map_or(true, |exported_page_ranges| {
                exported_page_ranges.includes_page_index(*i)
            })
        })
        .map(|(i, page)| {
            let bytes = export_image_page2(config, page, fmt)?;
            Ok(ExportedPage2 { index: i, bytes })
        })
        .collect::<Result<Vec<ExportedPage2>>>()
}

/// Export to one or multiple images.
pub fn export_image(
    document: &TypstPagedDocument,
    config: &CompileConfig,
    fmt: ImageExportFormat,
) -> Result<Vec<ExportedPage>> {
    // Determine whether we have indexable templates in output
    let can_handle_multiple =
        output_template::has_indexable_template(config.output.to_str().unwrap_or_default());

    let exported_pages = document
        .pages
        .iter()
        .enumerate()
        .filter(|(i, _)| {
            config.pages.as_ref().map_or(true, |exported_page_ranges| {
                exported_page_ranges.includes_page_index(*i)
            })
        })
        .collect::<Vec<_>>();

    // The results are collected in a `Vec<()>` which does not allocate.
    exported_pages
        .into_iter()
        .map(|(i, page)| {
            // Use output with converted path.
            let path = &config.output;
            let storage;
            let path = if can_handle_multiple {
                storage = output_template::format(
                    path.to_str().unwrap_or_default(),
                    i + 1,
                    document.pages.len(),
                );
                Path::new(&storage)
            } else {
                path
            };

            let bytes = export_image_page(config, page, fmt)?;
            Ok(ExportedPage {
                index: i,
                path: path.to_path_buf(),
                bytes,
            })
        })
        .collect::<Result<Vec<ExportedPage>>>()
}

pub(super) mod output_template {
    const INDEXABLE: [&str; 3] = ["{p}", "{0p}", "{n}"];

    pub fn has_indexable_template(output: &str) -> bool {
        INDEXABLE.iter().any(|template| output.contains(template))
    }

    pub fn format(output: &str, this_page: usize, total_pages: usize) -> String {
        // Find the base 10 width of number `i`
        fn width(i: usize) -> usize {
            1 + i.checked_ilog10().unwrap_or(0) as usize
        }

        let other_templates = ["{t}"];
        INDEXABLE
            .iter()
            .chain(other_templates.iter())
            .fold(output.to_string(), |out, template| {
                let replacement = match *template {
                    "{p}" => format!("{this_page}"),
                    "{0p}" | "{n}" => format!("{:01$}", this_page, width(total_pages)),
                    "{t}" => format!("{total_pages}"),
                    _ => unreachable!("unhandled template placeholder {template}"),
                };
                out.replace(template, replacement.as_str())
            })
    }
}

/// Export single image.
fn export_image_page2(
    config: &CompileConfig2,
    page: &Page,
    fmt: ImageExportFormat,
) -> Result<Bytes> {
    Ok(match fmt {
        ImageExportFormat::Png => {
            let pixmap = typst_render::render(page, config.ppi / 72.0);
            let buf = pixmap
                .encode_png()
                .map_err(|err| anyhow::anyhow!("failed to encode PNG file ({err})"))?;
            Bytes::new(buf)
        }
        ImageExportFormat::Svg => {
            let svg = typst_svg::svg(page);
            Bytes::from_string(svg)
        }
    })
}

/// Export single image.
fn export_image_page(config: &CompileConfig, page: &Page, fmt: ImageExportFormat) -> Result<Bytes> {
    Ok(match fmt {
        ImageExportFormat::Png => {
            let pixmap = typst_render::render(page, config.ppi / 72.0);
            let buf = pixmap
                .encode_png()
                .map_err(|err| anyhow::anyhow!("failed to encode PNG file ({err})"))?;
            Bytes::new(buf)
        }
        ImageExportFormat::Svg => {
            let svg = typst_svg::svg(page);
            Bytes::from_string(svg)
        }
    })
}
