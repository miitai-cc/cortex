use crate::api::documents::{
    directory_path, index_document_configured, normalized_directory, save_document_directory,
};
use crate::core::state::AppState;
use crate::db::repository::document_repo::DocumentRepo;
use crate::errors::AppError;
use crate::rag::embeddings::EmbeddingService;
use cortex_lib::utils::generate_id;
use futures_util::TryStreamExt;
use salvo::prelude::*;
use serde::Deserialize;
use sqlx::{Column, Row};

#[derive(Deserialize)]
struct SaveContentRequest {
    title: String,
    content_kind: String,
    directory: Option<String>,
    content: Option<String>,
    source_url: Option<String>,
    change_note: Option<String>,
    rag_enabled: Option<bool>,
    pageindex_enabled: Option<bool>,
    sql_query: Option<String>,
}

#[derive(Deserialize)]
struct ImportVersionRequest {
    content_id: Option<String>,
    document_id: String,
    title: String,
    directory: Option<String>,
    change_note: Option<String>,
}

fn strip_html(html: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for character in html.chars() {
        match character {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                output.push(' ');
            }
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

async fn resolve_markdown(body: &SaveContentRequest) -> Result<String, AppError> {
    match body.content_kind.as_str() {
        "markdown" => Ok(body.content.clone().unwrap_or_default()),
        "web" => {
            let url = body
                .source_url
                .as_deref()
                .ok_or_else(|| AppError::BadRequest("Web content requires source_url".into()))?;
            if !(url.starts_with("http://") || url.starts_with("https://")) {
                return Err(AppError::BadRequest(
                    "Only public HTTP/HTTPS URLs are supported".into(),
                ));
            }
            let response = reqwest::get(url)
                .await
                .map_err(|error| AppError::BadRequest(format!("Unable to fetch URL: {error}")))?;
            if !response.status().is_success() {
                return Err(AppError::BadRequest(format!(
                    "URL returned {}",
                    response.status()
                )));
            }
            let text = strip_html(
                &response
                    .text()
                    .await
                    .map_err(|error| AppError::Internal(error.to_string()))?,
            );
            Ok(format!(
                "# {}\n\n來源：{}\n\n{}",
                body.title.trim(),
                url,
                text
            ))
        }
        _ => Err(AppError::BadRequest(
            "Editable content_kind must be markdown or web".into(),
        )),
    }
}

fn validate_read_only_sql(sql: &str) -> Result<&str, AppError> {
    let sql = sql.trim();
    let upper = sql
        .to_ascii_uppercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if sql.is_empty() || !(upper.starts_with("SELECT ") || upper.starts_with("WITH ")) {
        return Err(AppError::BadRequest(
            "SQL must start with SELECT or WITH".into(),
        ));
    }
    if sql.contains(';') || sql.contains("--") || sql.contains("/*") || sql.contains("*/") {
        return Err(AppError::BadRequest(
            "SQL comments and multiple statements are not allowed".into(),
        ));
    }
    let padded = format!(" {upper} ");
    for keyword in [
        " INSERT ",
        " UPDATE ",
        " DELETE ",
        " DROP ",
        " ALTER ",
        " CREATE ",
        " REPLACE ",
        " TRUNCATE ",
        " GRANT ",
        " REVOKE ",
        " ATTACH ",
        " DETACH ",
        " PRAGMA ",
    ] {
        if padded.contains(keyword) {
            return Err(AppError::BadRequest(format!(
                "SQL keyword is not allowed: {}",
                keyword.trim()
            )));
        }
    }
    Ok(sql)
}

fn sql_cell(row: &sqlx::any::AnyRow, index: usize) -> String {
    if let Ok(value) = row.try_get::<Option<String>, _>(index) {
        return value.unwrap_or_else(|| "NULL".into());
    }
    if let Ok(value) = row.try_get::<Option<i64>, _>(index) {
        return value
            .map(|v| v.to_string())
            .unwrap_or_else(|| "NULL".into());
    }
    if let Ok(value) = row.try_get::<Option<f64>, _>(index) {
        return value
            .map(|v| v.to_string())
            .unwrap_or_else(|| "NULL".into());
    }
    if let Ok(value) = row.try_get::<Option<bool>, _>(index) {
        return value
            .map(|v| v.to_string())
            .unwrap_or_else(|| "NULL".into());
    }
    "[binary/unsupported]".into()
}

async fn database_to_markdown(
    state: &AppState,
    body: &SaveContentRequest,
) -> Result<String, AppError> {
    let query = validate_read_only_sql(body.sql_query.as_deref().unwrap_or(""))?;
    let mut stream = sqlx::query(query).fetch(&state.db.pool);
    let mut rows = Vec::new();
    while rows.len() < 1000 {
        match stream.try_next().await? {
            Some(row) => rows.push(row),
            None => break,
        }
    }
    let mut markdown = format!(
        "# {}\n\n## SQL\n\n```sql\n{}\n```\n\n## Query result\n\n",
        body.title.trim(),
        query
    );
    let Some(first) = rows.first() else {
        markdown.push_str("_查詢成功，結果為空。_\n");
        return Ok(markdown);
    };
    markdown.push('|');
    for column in first.columns() {
        markdown.push_str(&format!(" {} |", column.name().replace('|', "\\|")));
    }
    markdown.push_str("\n|");
    for _ in first.columns() {
        markdown.push_str(" --- |");
    }
    markdown.push('\n');
    for row in &rows {
        markdown.push('|');
        for index in 0..row.columns().len() {
            markdown.push_str(&format!(
                " {} |",
                sql_cell(row, index)
                    .replace('|', "\\|")
                    .replace(['\r', '\n'], " ")
            ));
        }
        markdown.push('\n');
    }
    if rows.len() == 1000 {
        markdown.push_str("\n> 結果已限制為前 1,000 列。\n");
    }
    Ok(markdown)
}

async fn create_version(
    state: &AppState,
    content_id: &str,
    version: i64,
    body: &SaveContentRequest,
    directory: &str,
) -> Result<serde_json::Value, AppError> {
    let markdown = if body.content_kind == "database" {
        database_to_markdown(state, body).await?
    } else {
        resolve_markdown(body).await?
    };
    let document_id = generate_id();
    let version_id = generate_id();
    let safe_title = body.title.trim().replace(['/', '\\'], "-");
    let filename = format!("{}-v{}.md", safe_title, version);
    let target_dir = directory_path(&state.config.upload_dir, directory);
    tokio::fs::create_dir_all(&target_dir)
        .await
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let path = target_dir.join(format!("{document_id}.md"));
    tokio::fs::write(&path, &markdown)
        .await
        .map_err(|error| AppError::Internal(error.to_string()))?;
    DocumentRepo::create(
        &state.db.pool,
        &document_id,
        &filename,
        "text/markdown",
        markdown.len() as i64,
    )
    .await?;
    save_document_directory(state, &document_id, directory).await?;
    let source_reference = if body.content_kind == "database" {
        body.sql_query.as_ref()
    } else {
        body.source_url.as_ref()
    };
    sqlx::query("INSERT INTO content_versions (id, content_id, version_number, document_id, source_kind, source_url, markdown_content, change_note, rag_enabled, pageindex_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
        .bind(&version_id).bind(content_id).bind(version).bind(&document_id).bind(&body.content_kind).bind(source_reference).bind(&markdown).bind(&body.change_note)
        .bind(body.rag_enabled.unwrap_or(true)).bind(body.pageindex_enabled.unwrap_or(true)).execute(&state.db.pool).await?;
    if body.rag_enabled.unwrap_or(true) || body.pageindex_enabled.unwrap_or(true) {
        let pageindex_enabled = body.pageindex_enabled.unwrap_or(true);
        let rag_enabled = body.rag_enabled.unwrap_or(true);
        let state_clone = state.clone();
        let document_id_clone = document_id.clone();
        let path = path.to_string_lossy().into_owned();
        tokio::spawn(async move {
            let embedding = EmbeddingService::new(&state_clone.config.embedding_model);
            if let Err(error) = index_document_configured(
                &state_clone,
                embedding,
                &document_id_clone,
                &path,
                "md",
                None,
                pageindex_enabled,
                rag_enabled,
            )
            .await
            {
                tracing::error!("Content version indexing failed: {error:#}");
                let _ =
                    DocumentRepo::update_status(&state_clone.db.pool, &document_id_clone, "failed")
                        .await;
            }
        });
    }
    Ok(
        serde_json::json!({"id": version_id, "version": version, "documentId": document_id, "status": "pending"}),
    )
}

#[handler]
async fn list(depot: &mut Depot) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let rows = sqlx::query("SELECT i.id, i.title, i.content_kind, i.relative_directory, i.source_url, i.current_version, i.created_at, i.updated_at, v.document_id, d.status FROM content_items i LEFT JOIN content_versions v ON v.content_id = i.id AND v.version_number = i.current_version LEFT JOIN documents d ON d.id = v.document_id ORDER BY i.updated_at DESC")
        .fetch_all(&state.db.pool).await?;
    let items = rows.into_iter().map(|row| serde_json::json!({
        "id": row.get::<String,_>("id"), "title": row.get::<String,_>("title"), "contentKind": row.get::<String,_>("content_kind"),
        "directory": row.get::<String,_>("relative_directory"), "sourceUrl": row.try_get::<String,_>("source_url").ok(), "currentVersion": row.get::<i64,_>("current_version"),
        "documentId": row.try_get::<String,_>("document_id").ok(), "status": row.try_get::<String,_>("status").ok(), "createdAt": row.try_get::<String,_>("created_at").ok(), "updatedAt": row.try_get::<String,_>("updated_at").ok()
    })).collect::<Vec<_>>();
    Ok(Json(serde_json::json!(items)))
}

#[handler]
async fn create(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let body = req
        .parse_json::<SaveContentRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Title is required".into()));
    }
    let directory = normalized_directory(body.directory.as_deref())?;
    let id = generate_id();
    let source_reference = if body.content_kind == "database" {
        body.sql_query.as_ref()
    } else {
        body.source_url.as_ref()
    };
    sqlx::query("INSERT INTO content_items (id, title, content_kind, relative_directory, source_url, current_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
        .bind(&id).bind(body.title.trim()).bind(&body.content_kind).bind(&directory).bind(source_reference).execute(&state.db.pool).await?;
    let version = create_version(state, &id, 1, &body, &directory).await?;
    Ok(Json(
        serde_json::json!({"id": id, "currentVersion": 1, "version": version}),
    ))
}

#[handler]
async fn update(depot: &mut Depot, req: &mut Request) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing content id".into()))?;
    let body = req
        .parse_json::<SaveContentRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    let row =
        sqlx::query("SELECT current_version, relative_directory FROM content_items WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.db.pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Content not found".into()))?;
    let version = row.get::<i64, _>("current_version") + 1;
    let existing_directory = row
        .try_get::<String, _>("relative_directory")
        .unwrap_or_else(|_| "/".into());
    let directory = normalized_directory(
        body.directory
            .as_deref()
            .or(Some(existing_directory.as_str())),
    )?;
    let saved = create_version(state, &id, version, &body, &directory).await?;
    let source_reference = if body.content_kind == "database" {
        body.sql_query.as_ref()
    } else {
        body.source_url.as_ref()
    };
    sqlx::query("UPDATE content_items SET title = ?, content_kind = ?, relative_directory = ?, source_url = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(body.title.trim()).bind(&body.content_kind).bind(&directory).bind(source_reference).bind(version).bind(&id).execute(&state.db.pool).await?;
    Ok(Json(
        serde_json::json!({"id": id, "currentVersion": version, "version": saved}),
    ))
}

#[handler]
async fn versions(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let id = req
        .param::<String>("id")
        .ok_or_else(|| AppError::BadRequest("Missing content id".into()))?;
    let rows = sqlx::query("SELECT v.id, v.version_number, v.document_id, v.source_kind, v.source_url, v.markdown_content, v.change_note, v.rag_enabled, v.pageindex_enabled, v.created_at, d.status FROM content_versions v LEFT JOIN documents d ON d.id = v.document_id WHERE v.content_id = ? ORDER BY v.version_number DESC").bind(&id).fetch_all(&state.db.pool).await?;
    let items = rows.into_iter().map(|row| serde_json::json!({"id": row.get::<String,_>("id"), "version": row.get::<i64,_>("version_number"), "documentId": row.get::<String,_>("document_id"), "sourceKind": row.get::<String,_>("source_kind"), "sourceUrl": row.try_get::<String,_>("source_url").ok(), "content": row.try_get::<String,_>("markdown_content").ok(), "changeNote": row.try_get::<String,_>("change_note").ok(), "ragEnabled": row.get::<bool,_>("rag_enabled"), "pageindexEnabled": row.get::<bool,_>("pageindex_enabled"), "status": row.try_get::<String,_>("status").ok(), "createdAt": row.try_get::<String,_>("created_at").ok()})).collect::<Vec<_>>();
    Ok(Json(serde_json::json!(items)))
}

#[handler]
async fn import_version(
    depot: &mut Depot,
    req: &mut Request,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let body = req
        .parse_json::<ImportVersionRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    let document = DocumentRepo::find_by_id(&state.db.pool, &body.document_id).await?;
    let directory = normalized_directory(body.directory.as_deref())?;
    let source_kind = std::path::Path::new(&document.filename)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("file")
        .to_ascii_lowercase();
    let content_id = body.content_id.unwrap_or_else(generate_id);
    let existing = sqlx::query("SELECT current_version FROM content_items WHERE id = ?")
        .bind(&content_id)
        .fetch_optional(&state.db.pool)
        .await?;
    let version = existing
        .as_ref()
        .map(|row| row.get::<i64, _>("current_version") + 1)
        .unwrap_or(1);
    if existing.is_none() {
        sqlx::query("INSERT INTO content_items (id, title, content_kind, relative_directory, current_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
            .bind(&content_id).bind(body.title.trim()).bind(&source_kind).bind(&directory).bind(version).execute(&state.db.pool).await?;
    } else {
        sqlx::query("UPDATE content_items SET title = ?, content_kind = ?, relative_directory = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(body.title.trim()).bind(&source_kind).bind(&directory).bind(version).bind(&content_id).execute(&state.db.pool).await?;
    }
    let version_id = generate_id();
    sqlx::query("INSERT INTO content_versions (id, content_id, version_number, document_id, source_kind, change_note, rag_enabled, pageindex_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
        .bind(&version_id).bind(&content_id).bind(version).bind(&body.document_id).bind(&source_kind).bind(&body.change_note).bind(true).bind(true).execute(&state.db.pool).await?;
    Ok(Json(
        serde_json::json!({"id": content_id, "currentVersion": version, "versionId": version_id, "documentId": body.document_id}),
    ))
}

pub fn router() -> Router {
    Router::with_path("content")
        .get(list)
        .post(create)
        .push(Router::with_path("import-version").post(import_version))
        .push(Router::with_path("<id>").put(update))
        .push(Router::with_path("<id>/versions").get(versions))
}
