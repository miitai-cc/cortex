use crate::config::{AppConfig, DbType};
use sqlx::any::AnyPoolOptions;
use sqlx::{Any, Pool};

pub mod repository;

#[derive(Clone)]
pub struct Database {
    pub pool: Pool<Any>,
    pub db_type: DbType,
}

impl Database {
    pub async fn new(config: &AppConfig) -> Self {
        sqlx::any::install_default_drivers();
        Self::ensure_data_dir(config).await;
        if !AnyPoolOptions::new()
            .connect(&config.database_url)
            .await
            .is_ok()
        {
            AnyPoolOptions::new()
                .connect(&config.database_url)
                .await
                .expect("Failed to connect to database");
        }
        let pool = AnyPoolOptions::new()
            .max_connections(10)
            .connect(&config.database_url)
            .await
            .expect("Failed to create database pool");
        Self {
            pool,
            db_type: config.db_type.clone(),
        }
    }

    async fn ensure_data_dir(config: &AppConfig) {
        if config.db_type != DbType::Sqlite {
            return;
        }
        let path_str = config
            .database_url
            .strip_prefix("sqlite:")
            .unwrap_or(&config.database_url)
            .split('?')
            .next()
            .unwrap_or(&config.database_url);
        if let Some(parent) = std::path::Path::new(path_str).parent() {
            if !parent.exists() {
                let _ = tokio::fs::create_dir_all(parent).await;
                tracing::info!("Created data directory: {:?}", parent);
            }
        }
    }

    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        let text_type = match self.db_type {
            DbType::Postgresql => "TEXT",
            _ => "TEXT",
        };
        let timestamp_default = match self.db_type {
            DbType::Sqlite => "TEXT DEFAULT CURRENT_TIMESTAMP",
            DbType::Postgresql => "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
            _ => "DATETIME DEFAULT CURRENT_TIMESTAMP",
        };
        // sqlx::Any cannot decode SQLite's native DATETIME value. The collaboration
        // module stores ISO-compatible text timestamps so all supported Any drivers
        // expose the same value type.
        let portable_timestamp_default = match self.db_type {
            DbType::Sqlite => "TEXT DEFAULT CURRENT_TIMESTAMP",
            _ => timestamp_default,
        };
        let blob_type = match self.db_type {
            DbType::Sqlite | DbType::Postgresql => "BYTEA",
            _ => "BLOB",
        };
        let boolean_type = match self.db_type {
            DbType::Sqlite => "INTEGER",
            _ => "BOOLEAN",
        };

        let id_column = match self.db_type {
            DbType::Postgresql => "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
            _ => "id TEXT PRIMARY KEY",
        };

        let create_documents = format!(
            "CREATE TABLE IF NOT EXISTS documents (
                {id_col},
                filename {text} NOT NULL,
                content_type {text} NOT NULL,
                file_size BIGINT NOT NULL,
                metadata {text},
                status {text} NOT NULL DEFAULT 'pending',
                created_at {ts},
                updated_at {ts}
            )",
            id_col = id_column,
            text = text_type,
            ts = timestamp_default
        );

        let create_chunks = format!(
            "CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id {text} NOT NULL,
                content {text} NOT NULL,
                embedding {blob},
                metadata {text},
                chunk_index INTEGER NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )",
            text = text_type,
            blob = blob_type
        );

        let create_users = format!(
            "CREATE TABLE IF NOT EXISTS users (
                id {id_col},
                username {text} UNIQUE NOT NULL,
                email {text} UNIQUE NOT NULL,
                password_hash {text} NOT NULL,
                role {text} NOT NULL DEFAULT 'user',
                is_active {bool} NOT NULL DEFAULT 1,
                created_at {ts}
            )",
            id_col = id_column,
            text = text_type,
            ts = timestamp_default,
            bool = boolean_type
        );

        let create_conversations = format!(
            "CREATE TABLE IF NOT EXISTS conversations (
                id {text} PRIMARY KEY,
                title {text} NOT NULL,
                created_at {ts},
                updated_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );

        let create_researches = format!(
            "CREATE TABLE IF NOT EXISTS researches (
                id {text} PRIMARY KEY,
                topic {text} NOT NULL,
                synthesis {text},
                created_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );

        let create_content_items = format!(
            "CREATE TABLE IF NOT EXISTS content_items (
                id {text} PRIMARY KEY,
                title {text} NOT NULL,
                content_kind {text} NOT NULL,
                relative_directory {text} NOT NULL DEFAULT '/',
                source_url {text},
                current_version INTEGER NOT NULL DEFAULT 1,
                created_at {ts},
                updated_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );

        let create_content_versions = format!(
            "CREATE TABLE IF NOT EXISTS content_versions (
                id {text} PRIMARY KEY,
                content_id {text} NOT NULL,
                version_number INTEGER NOT NULL,
                document_id {text} NOT NULL,
                source_kind {text} NOT NULL,
                source_url {text},
                markdown_content {text},
                change_note {text},
                rag_enabled {bool} NOT NULL DEFAULT 1,
                pageindex_enabled {bool} NOT NULL DEFAULT 1,
                created_at {ts},
                UNIQUE(content_id, version_number),
                FOREIGN KEY (content_id) REFERENCES content_items(id),
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )",
            text = text_type,
            bool = boolean_type,
            ts = timestamp_default
        );
        let create_knowledge_records = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_records (
                id {text} PRIMARY KEY, document_id {text}, content_id {text}, title {text} NOT NULL,
                category {text} NOT NULL DEFAULT '未分類', record_type {text} NOT NULL DEFAULT 'document',
                workflow_status {text} NOT NULL DEFAULT 'draft', tags {text}, owner_id {text}, reviewer_id {text},
                created_at {ts}, updated_at {ts}
            )", text = text_type, ts = timestamp_default
        );
        let create_knowledge_interactions = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_interactions (
                id {text} PRIMARY KEY, user_id {text} NOT NULL, target_id {text} NOT NULL,
                interaction_type {text} NOT NULL, score INTEGER, comment {text}, created_at {ts},
                UNIQUE(user_id, target_id, interaction_type)
            )",
            text = text_type,
            ts = timestamp_default
        );
        let create_expert_profiles = format!(
            "CREATE TABLE IF NOT EXISTS expert_profiles (
                user_id {text} PRIMARY KEY, display_name {text} NOT NULL, expertise {text} NOT NULL,
                bio {text}, contact {text}, contribution_points INTEGER NOT NULL DEFAULT 0, updated_at {ts}
            )", text = text_type, ts = timestamp_default
        );
        let create_point_events = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_point_events (
                id {text} PRIMARY KEY, user_id {text} NOT NULL, points INTEGER NOT NULL,
                reason {text} NOT NULL, target_id {text}, created_at {ts}
            )",
            text = text_type,
            ts = timestamp_default
        );
        let create_knowledge_categories = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_categories (
                id {text} PRIMARY KEY, name {text} NOT NULL UNIQUE, description {text}, color {text},
                created_by {text}, created_at {ts}, updated_at {ts}
            )", text = text_type, ts = timestamp_default
        );
        let create_knowledge_details = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_details (
                record_id {text} PRIMARY KEY, question {text}, answer {text}, project_summary {text},
                deliverables {text}, FOREIGN KEY (record_id) REFERENCES knowledge_records(id)
            )", text = text_type
        );
        let create_knowledge_comments = format!(
            "CREATE TABLE IF NOT EXISTS knowledge_comments (
                id {text} PRIMARY KEY, record_id {text} NOT NULL, user_id {text} NOT NULL,
                username {text} NOT NULL, content {text} NOT NULL, parent_id {text}, is_best INTEGER NOT NULL DEFAULT 0,
                created_at {ts}, updated_at {ts}, FOREIGN KEY (record_id) REFERENCES knowledge_records(id)
            )", text = text_type, ts = timestamp_default
        );
        let create_collaboration_workspaces = format!(
            "CREATE TABLE IF NOT EXISTS collaboration_workspaces (
                id {text} PRIMARY KEY, name {text} NOT NULL, description {text}, created_by {text} NOT NULL,
                created_at {ts}, updated_at {ts}
            )", text=text_type, ts=portable_timestamp_default
        );
        let create_collaboration_channels = format!(
            "CREATE TABLE IF NOT EXISTS collaboration_channels (
                id {text} PRIMARY KEY, workspace_id {text} NOT NULL, name {text} NOT NULL,
                description {text}, is_private INTEGER NOT NULL DEFAULT 0, created_by {text} NOT NULL,
                created_at {ts}, updated_at {ts}, UNIQUE(workspace_id,name)
            )", text=text_type, ts=portable_timestamp_default
        );
        let create_channel_members = format!(
            "CREATE TABLE IF NOT EXISTS collaboration_channel_members (
                channel_id {text} NOT NULL, user_id {text} NOT NULL, role {text} NOT NULL DEFAULT 'member',
                last_read_at {ts}, PRIMARY KEY(channel_id,user_id)
            )", text=text_type, ts=portable_timestamp_default
        );
        let create_collaboration_messages = format!(
            "CREATE TABLE IF NOT EXISTS collaboration_messages (
                id {text} PRIMARY KEY, channel_id {text} NOT NULL, user_id {text} NOT NULL,
                username {text} NOT NULL, content {text} NOT NULL, parent_id {text}, issue_id {text},
                created_at {ts}, updated_at {ts}, deleted_at {text}
            )", text=text_type, ts=portable_timestamp_default
        );
        let create_message_reactions = format!(
            "CREATE TABLE IF NOT EXISTS collaboration_message_reactions (
                message_id {text} NOT NULL, user_id {text} NOT NULL, emoji {text} NOT NULL,
                created_at {ts}, PRIMARY KEY(message_id,user_id,emoji)
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_message_reads = format!(
            "CREATE TABLE IF NOT EXISTS collaboration_message_reads (
                message_id {text} NOT NULL, user_id {text} NOT NULL, read_at {ts},
                PRIMARY KEY(message_id,user_id)
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_issues = format!(
            "CREATE TABLE IF NOT EXISTS issues (
                id {text} PRIMARY KEY, issue_key {text} NOT NULL UNIQUE, title {text} NOT NULL,
                description {text}, issue_type {text} NOT NULL DEFAULT 'task', status {text} NOT NULL DEFAULT 'open',
                priority {text} NOT NULL DEFAULT 'medium', reporter_id {text} NOT NULL, assignee_id {text},
                channel_id {text}, due_date {text}, labels {text}, created_at {ts}, updated_at {ts}
            )", text=text_type, ts=portable_timestamp_default
        );
        let create_issue_comments = format!(
            "CREATE TABLE IF NOT EXISTS issue_comments (
                id {text} PRIMARY KEY, issue_id {text} NOT NULL, user_id {text} NOT NULL,
                username {text} NOT NULL, content {text} NOT NULL, created_at {ts}, updated_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_issue_history = format!(
            "CREATE TABLE IF NOT EXISTS issue_history (
                id {text} PRIMARY KEY, issue_id {text} NOT NULL, user_id {text} NOT NULL,
                username {text} NOT NULL, action {text} NOT NULL, old_value {text}, new_value {text},
                created_at {ts}
            )", text=text_type, ts=portable_timestamp_default
        );
        let create_rag_query_events = format!(
            "CREATE TABLE IF NOT EXISTS rag_query_events (
                id {text} PRIMARY KEY, query_text {text} NOT NULL, duration_ms BIGINT NOT NULL,
                result_count INTEGER NOT NULL DEFAULT 0, created_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_system_settings = format!(
            "CREATE TABLE IF NOT EXISTS system_settings (
                setting_key {text} PRIMARY KEY, setting_value {text} NOT NULL,
                updated_by {text}, updated_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_department_items = format!(
            "CREATE TABLE IF NOT EXISTS department_items (
                id {text} PRIMARY KEY, department {text} NOT NULL, item_type {text} NOT NULL,
                title {text} NOT NULL, description {text}, status {text} NOT NULL DEFAULT 'planned',
                priority {text} NOT NULL DEFAULT 'medium', owner_name {text} NOT NULL,
                amount BIGINT, due_date {text}, metadata {text} NOT NULL DEFAULT '{{}}',
                created_by {text} NOT NULL, created_at {ts}, updated_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_projects = format!(
            "CREATE TABLE IF NOT EXISTS projects (
                id {text} PRIMARY KEY, code {text} NOT NULL UNIQUE, name {text} NOT NULL,
                description {text}, status {text} NOT NULL DEFAULT 'planning',
                priority {text} NOT NULL DEFAULT 'medium', manager_id {text}, manager_name {text} NOT NULL,
                start_date {text}, end_date {text}, budget_total BIGINT NOT NULL DEFAULT 0,
                collaboration_workspace_id {text}, collaboration_channel_id {text},
                related_links {text} NOT NULL DEFAULT '[]', created_by {text} NOT NULL,
                created_at {ts}, updated_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_project_records = format!(
            "CREATE TABLE IF NOT EXISTS project_records (
                id {text} PRIMARY KEY, project_id {text} NOT NULL, record_type {text} NOT NULL,
                title {text} NOT NULL, description {text}, status {text} NOT NULL,
                priority {text} NOT NULL DEFAULT 'medium', assignee_id {text}, assignee_name {text},
                start_date {text}, end_date {text}, amount BIGINT, progress INTEGER NOT NULL DEFAULT 0,
                metadata {text} NOT NULL DEFAULT '{{}}', created_by {text} NOT NULL,
                created_at {ts}, updated_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_workflow_definitions = format!(
            "CREATE TABLE IF NOT EXISTS workflow_definitions (
                id {text} PRIMARY KEY, workflow_key {text} NOT NULL UNIQUE, name {text} NOT NULL,
                description {text}, status {text} NOT NULL DEFAULT 'draft', current_version INTEGER NOT NULL DEFAULT 0,
                nodes {text} NOT NULL DEFAULT '[]', edges {text} NOT NULL DEFAULT '[]',
                created_by {text} NOT NULL, created_at {ts}, updated_at {ts}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_workflow_versions = format!(
            "CREATE TABLE IF NOT EXISTS workflow_versions (
                id {text} PRIMARY KEY, workflow_id {text} NOT NULL, version INTEGER NOT NULL,
                nodes {text} NOT NULL, edges {text} NOT NULL, created_by {text} NOT NULL,
                created_at {ts}, UNIQUE(workflow_id,version)
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_workflow_instances = format!(
            "CREATE TABLE IF NOT EXISTS workflow_instances (
                id {text} PRIMARY KEY, workflow_id {text} NOT NULL, workflow_key {text} NOT NULL,
                version INTEGER NOT NULL, status {text} NOT NULL DEFAULT 'queued', input_data {text} NOT NULL DEFAULT '{{}}',
                context_data {text} NOT NULL DEFAULT '{{}}', current_node_id {text}, started_by {text} NOT NULL,
                started_by_name {text} NOT NULL, started_at {ts}, updated_at {ts}, completed_at {text}, error_message {text}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_workflow_step_runs = format!(
            "CREATE TABLE IF NOT EXISTS workflow_step_runs (
                id {text} PRIMARY KEY, instance_id {text} NOT NULL, node_id {text} NOT NULL,
                node_type {text} NOT NULL, node_label {text} NOT NULL, status {text} NOT NULL,
                input_data {text}, output_data {text}, error_message {text}, started_at {ts}, completed_at {text}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );
        let create_workflow_tasks = format!(
            "CREATE TABLE IF NOT EXISTS workflow_tasks (
                id {text} PRIMARY KEY, instance_id {text} NOT NULL, node_id {text} NOT NULL,
                title {text} NOT NULL, instructions {text}, assignee_id {text} NOT NULL,
                assignee_name {text} NOT NULL, status {text} NOT NULL DEFAULT 'pending', due_date {text},
                form_data {text} NOT NULL DEFAULT '{{}}', decision_comment {text}, created_at {ts},
                updated_at {ts}, completed_at {text}
            )",
            text = text_type,
            ts = portable_timestamp_default
        );

        sqlx::query(&create_documents).execute(&self.pool).await?;
        sqlx::query(&create_chunks).execute(&self.pool).await?;
        sqlx::query(&create_users).execute(&self.pool).await?;
        sqlx::query(&create_conversations)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_researches).execute(&self.pool).await?;
        sqlx::query(&create_content_items)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_content_versions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_records)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_interactions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_expert_profiles)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_point_events)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_categories)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_details)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_knowledge_comments)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_collaboration_workspaces)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_collaboration_channels)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_channel_members)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_collaboration_messages)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_message_reactions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_message_reads)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_issues).execute(&self.pool).await?;
        sqlx::query(&create_issue_comments)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_issue_history)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_rag_query_events)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_system_settings)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_department_items)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_projects).execute(&self.pool).await?;
        sqlx::query(&create_project_records)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_workflow_definitions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_workflow_versions)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_workflow_instances)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_workflow_step_runs)
            .execute(&self.pool)
            .await?;
        sqlx::query(&create_workflow_tasks)
            .execute(&self.pool)
            .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_department_items_department_updated ON department_items(department, updated_at)",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_projects_status_updated ON projects(status, updated_at)",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_project_records_project_type ON project_records(project_id, record_type)",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_project_records_assignee ON project_records(assignee_id, status)",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status_updated ON workflow_definitions(status, updated_at)",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_started ON workflow_instances(workflow_id, started_at)",
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assignee_status ON workflow_tasks(assignee_id, status)",
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
