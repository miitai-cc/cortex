use anyhow::Result;

pub async fn read_powerpoint(file_path: &str) -> Result<Vec<String>> {
    let bytes = tokio::fs::read(file_path).await?;
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)?;

    let mut slides = Vec::new();

    for i in 1.. {
        let slide_name = format!("ppt/slides/slide{}.xml", i);
        match archive.by_name(&slide_name) {
            Ok(mut file) => {
                use std::io::Read;
                let mut xml_content = String::new();
                file.read_to_string(&mut xml_content)?;
                slides.push(extract_text_from_pptx_xml(&xml_content));
            }
            Err(_) => break,
        }
    }

    Ok(slides)
}

fn extract_text_from_pptx_xml(xml: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    let mut in_t_tag = false;
    let mut tag_buffer = String::new();

    for ch in xml.chars() {
        if ch == '<' {
            in_tag = true;
            tag_buffer.clear();
            continue;
        }
        if ch == '>' {
            in_tag = false;
            if tag_buffer.starts_with("a:t") && !tag_buffer.starts_with("a:tab") {
                in_t_tag = true;
            }
            if tag_buffer.starts_with("/a:t") || tag_buffer.starts_with("/a:r") {
                if in_t_tag {
                    text.push('\n');
                }
                in_t_tag = false;
            }
            continue;
        }
        if in_tag {
            tag_buffer.push(ch);
        } else if in_t_tag {
            text.push(ch);
        }
    }

    text
}

pub async fn create_powerpoint(titles: Vec<String>, output_path: &str) -> Result<()> {
    use std::io::Write;
    let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let opts = zip::write::FileOptions::<()>::default();

    archive.add_directory("_rels/", opts)?;
    archive.add_directory("ppt/", opts)?;
    archive.add_directory("ppt/slides/", opts)?;
    archive.add_directory("ppt/_rels/", opts)?;
    archive.add_directory("docProps/", opts)?;

    archive.start_file("[Content_Types].xml", opts)?;
    archive.write_all(br#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
            <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
        </Types>"#)?;

    archive.start_file("ppt/presentation.xml", opts)?;
    let pres_xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
            <p:sldIdLst>
                <p:sldId id="256" r:id="rId1"/>
            </p:sldIdLst>
        </p:presentation>"#;
    archive.write_all(pres_xml.as_bytes())?;

    for (i, title) in titles.iter().enumerate() {
        let slide_path = format!("ppt/slides/slide{}.xml", i + 1);
        archive.start_file(&slide_path, opts)?;
        let slide_xml = format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
                <p:spTree>
                    <p:nvGrpSpPr><p:nvPr/><p:cNvPr id="1" name=""/><p:nvGrpSpPr/></p:nvGrpSpPr>
                    <p:grpSpPr/>
                    <p:sp>
                        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/></p:nvSpPr>
                        <p:spPr/>
                        <p:txBody>
                            <a:p><a:r><a:rPr lang="zh-TW"/><a:t>{}</a:t></a:r></a:p>
                        </p:txBody>
                    </p:sp>
                </p:spTree>
            </p:sld>"#,
            title.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
        );
        archive.write_all(slide_xml.as_bytes())?;
    }

    let cursor = archive.finish()?;
    tokio::fs::write(output_path, cursor.into_inner()).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_pptx_text() {
        let xml = r#"<p:sld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide Title</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:sld>"#;
        let text = extract_text_from_pptx_xml(xml);
        assert!(text.contains("Slide Title"));
    }
}
