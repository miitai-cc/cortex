//! Workflow definition, version, execution, and human-task management.
//!
//! The HTTP contract adapts `eiva-fe-workflow` to Cortex authentication and
//! persistence. Automated graph steps run in the backend; `basicNode` may be
//! configured as a human task and resumed from the personal task queue.

use crate::core::state::AppState;
use crate::errors::AppError;
use crate::rag::llm::LLMService;
use chrono::{Duration, Utc};
use cortex_lib::utils::generate_id;
use eiva_be_security::jwt::{verify_token, Claims};
use evalexpr::ContextWithMutableVariables;
use salvo::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{any::AnyRow, Row};
use std::collections::{HashMap, HashSet, VecDeque};

const TASK_ACTIONS: &[&str] = &["approved", "rejected"];
const EXECUTABLE_NODE_TYPES: &[&str] = &[
    "startNode",
    "agentNode",
    "toolNode",
    "skillNode",
    "mcpNode",
    "variableNode",
    "calculateNode",
    "conditionNode",
    "endNode",
    "basicNode",
    "noteNode",
    "swimlaneNode",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlowNode {
    id: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(default)]
    data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FlowEdge {
    #[serde(default)]
    id: String,
    source: String,
    target: String,
    #[serde(rename = "sourceHandle")]
    source_handle: Option<String>,
}

#[derive(Debug, Clone)]
struct WorkflowGraph {
    nodes: Vec<FlowNode>,
    edges: Vec<FlowEdge>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkflowSaveRequest {
    nodes: Vec<Value>,
    edges: Vec<Value>,
    name: Option<String>,
    description: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskDecisionRequest {
    action: String,
    comment: Option<String>,
    form_data: Option<Value>,
}

fn authentication(req: &Request, state: &AppState) -> Result<Claims, AppError> {
    let header = req
        .headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".into()))?;
    let token = header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid Authorization header".into()))?;
    verify_token(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired token".into()))
}

fn path_value(req: &Request, key: &str) -> Result<String, AppError> {
    req.param::<String>(key)
        .ok_or_else(|| AppError::BadRequest(format!("Missing {key}")))
}

fn optional_text(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn validate_key(key: &str) -> Result<(), AppError> {
    let trimmed = key.trim();
    if trimmed.is_empty()
        || trimmed.chars().count() > 80
        || !trimmed
            .chars()
            .all(|character| character.is_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(AppError::BadRequest(
            "Workflow key must contain 1 to 80 letters, numbers, '-' or '_'".into(),
        ));
    }
    Ok(())
}

fn parse_graph(nodes: &[Value], edges: &[Value]) -> Result<WorkflowGraph, AppError> {
    if nodes.len() > 200 || edges.len() > 500 {
        return Err(AppError::BadRequest(
            "A workflow is limited to 200 nodes and 500 edges".into(),
        ));
    }
    let nodes = nodes
        .iter()
        .cloned()
        .map(serde_json::from_value::<FlowNode>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::BadRequest(format!("Invalid workflow node: {error}")))?;
    let edges = edges
        .iter()
        .cloned()
        .map(serde_json::from_value::<FlowEdge>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::BadRequest(format!("Invalid workflow edge: {error}")))?;
    let mut ids = HashSet::new();
    for node in &nodes {
        if node.id.trim().is_empty() || !ids.insert(node.id.clone()) {
            return Err(AppError::BadRequest(
                "Node IDs must be non-empty and unique".into(),
            ));
        }
        if !EXECUTABLE_NODE_TYPES.contains(&node.node_type.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Unsupported node type: {}",
                node.node_type
            )));
        }
    }
    for edge in &edges {
        if !ids.contains(&edge.source) || !ids.contains(&edge.target) {
            return Err(AppError::BadRequest(
                "Every edge must reference an existing node".into(),
            ));
        }
    }
    Ok(WorkflowGraph { nodes, edges })
}

fn validate_publishable(graph: &WorkflowGraph) -> Result<(), AppError> {
    let starts = graph
        .nodes
        .iter()
        .filter(|node| node.node_type == "startNode")
        .collect::<Vec<_>>();
    let ends = graph
        .nodes
        .iter()
        .filter(|node| node.node_type == "endNode")
        .collect::<Vec<_>>();
    if starts.len() != 1 || ends.is_empty() {
        return Err(AppError::BadRequest(
            "A published workflow requires exactly one start node and at least one end node".into(),
        ));
    }
    let decorative =
        |node: &FlowNode| matches!(node.node_type.as_str(), "noteNode" | "swimlaneNode");
    let mut reachable = HashSet::new();
    let mut queue = VecDeque::from([starts[0].id.clone()]);
    while let Some(id) = queue.pop_front() {
        if !reachable.insert(id.clone()) {
            continue;
        }
        for edge in graph.edges.iter().filter(|edge| edge.source == id) {
            queue.push_back(edge.target.clone());
        }
    }
    if graph
        .nodes
        .iter()
        .any(|node| !decorative(node) && !reachable.contains(&node.id))
    {
        return Err(AppError::BadRequest(
            "Every executable node must be reachable from the start node".into(),
        ));
    }
    if !ends.iter().any(|node| reachable.contains(&node.id)) {
        return Err(AppError::BadRequest(
            "No end node is reachable from start".into(),
        ));
    }
    for node in graph
        .nodes
        .iter()
        .filter(|node| reachable.contains(&node.id) && !decorative(node))
    {
        let outgoing = graph
            .edges
            .iter()
            .filter(|edge| edge.source == node.id)
            .collect::<Vec<_>>();
        if node.node_type == "conditionNode" {
            let has_true = outgoing
                .iter()
                .any(|edge| edge.source_handle.as_deref() == Some("source-right"));
            let has_false = outgoing
                .iter()
                .any(|edge| edge.source_handle.as_deref() == Some("source-bottom"));
            if !has_true || !has_false {
                return Err(AppError::BadRequest(
                    "Every condition node requires right (true) and bottom (false) connections"
                        .into(),
                ));
            }
        } else if node.node_type == "endNode" && !outgoing.is_empty() {
            return Err(AppError::BadRequest(
                "End nodes cannot have outgoing connections".into(),
            ));
        } else if node.node_type != "endNode" && outgoing.len() != 1 {
            return Err(AppError::BadRequest(format!(
                "Node '{}' requires exactly one outgoing connection",
                node.data
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or(&node.id)
            )));
        }
    }
    let executable_ids = graph
        .nodes
        .iter()
        .filter(|node| reachable.contains(&node.id) && !decorative(node))
        .map(|node| node.id.clone())
        .collect::<HashSet<_>>();
    let mut indegree = executable_ids
        .iter()
        .map(|id| (id.clone(), 0_usize))
        .collect::<HashMap<_, _>>();
    for edge in &graph.edges {
        if executable_ids.contains(&edge.source) && executable_ids.contains(&edge.target) {
            *indegree.entry(edge.target.clone()).or_default() += 1;
        }
    }
    let mut acyclic_queue = indegree
        .iter()
        .filter_map(|(id, degree)| (*degree == 0).then_some(id.clone()))
        .collect::<VecDeque<_>>();
    let mut visited = 0_usize;
    while let Some(id) = acyclic_queue.pop_front() {
        visited += 1;
        for edge in graph.edges.iter().filter(|edge| edge.source == id) {
            if let Some(degree) = indegree.get_mut(&edge.target) {
                *degree -= 1;
                if *degree == 0 {
                    acyclic_queue.push_back(edge.target.clone());
                }
            }
        }
    }
    if visited != executable_ids.len() {
        return Err(AppError::BadRequest(
            "Workflow cycles are not allowed; the graph must be a DAG".into(),
        ));
    }
    Ok(())
}

fn definition_select() -> &'static str {
    "SELECT id,workflow_key,name,description,status,current_version,nodes,edges,created_by,\
     CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at FROM workflow_definitions"
}

fn definition_json(row: &AnyRow, identity: &Claims, include_graph: bool) -> Value {
    let created_by = row.get::<String, _>("created_by");
    let mut value = serde_json::json!({
        "id":row.get::<String,_>("id"),"key":row.get::<String,_>("workflow_key"),
        "name":row.get::<String,_>("name"),"description":row.try_get::<String,_>("description").ok(),
        "status":row.get::<String,_>("status"),"currentVersion":row.get::<i64,_>("current_version"),
        "createdBy":created_by,"createdAt":row.try_get::<String,_>("created_at").ok(),
        "updatedAt":row.try_get::<String,_>("updated_at").ok(),
        "canEdit":identity.role == "admin" || created_by == identity.sub
    });
    if include_graph {
        value["nodes"] = serde_json::from_str(&row.get::<String, _>("nodes"))
            .unwrap_or_else(|_| serde_json::json!([]));
        value["edges"] = serde_json::from_str(&row.get::<String, _>("edges"))
            .unwrap_or_else(|_| serde_json::json!([]));
    }
    value
}

async fn find_definition(state: &AppState, key: &str) -> Result<AnyRow, AppError> {
    sqlx::query(&format!("{} WHERE workflow_key=?", definition_select()))
        .bind(key)
        .fetch_optional(&state.db.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Workflow not found".into()))
}

fn ensure_editable(row: &AnyRow, identity: &Claims) -> Result<(), AppError> {
    if identity.role != "admin" && row.get::<String, _>("created_by") != identity.sub {
        return Err(AppError::Unauthorized(
            "Only the workflow creator or an administrator can change this definition".into(),
        ));
    }
    Ok(())
}

fn instance_json(row: &AnyRow) -> Value {
    serde_json::json!({
        "id":row.get::<String,_>("id"),"workflowId":row.get::<String,_>("workflow_id"),
        "workflowKey":row.get::<String,_>("workflow_key"),"version":row.get::<i64,_>("version"),
        "status":row.get::<String,_>("status"),"input":row.try_get::<String,_>("input_data").ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok()).unwrap_or_else(|| serde_json::json!({})),
        "output":row.try_get::<String,_>("context_data").ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok()).unwrap_or_else(|| serde_json::json!({})),
        "currentNodeId":row.try_get::<String,_>("current_node_id").ok(),
        "startedBy":row.get::<String,_>("started_by"),"startedByName":row.get::<String,_>("started_by_name"),
        "startedAt":row.try_get::<String,_>("started_at").ok(),"updatedAt":row.try_get::<String,_>("updated_at").ok(),
        "completedAt":row.try_get::<String,_>("completed_at").ok(),"errorMessage":row.try_get::<String,_>("error_message").ok()
    })
}

fn task_json(row: &AnyRow) -> Value {
    serde_json::json!({
        "id":row.get::<String,_>("id"),"instanceId":row.get::<String,_>("instance_id"),
        "nodeId":row.get::<String,_>("node_id"),"title":row.get::<String,_>("title"),
        "instructions":row.try_get::<String,_>("instructions").ok(),"assigneeId":row.get::<String,_>("assignee_id"),
        "assigneeName":row.get::<String,_>("assignee_name"),"status":row.get::<String,_>("status"),
        "dueDate":row.try_get::<String,_>("due_date").ok(),"formData":row.try_get::<String,_>("form_data").ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok()).unwrap_or_else(|| serde_json::json!({})),
        "decisionComment":row.try_get::<String,_>("decision_comment").ok(),
        "createdAt":row.try_get::<String,_>("created_at").ok(),"updatedAt":row.try_get::<String,_>("updated_at").ok(),
        "completedAt":row.try_get::<String,_>("completed_at").ok()
    })
}

#[handler]
async fn list_workflows(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let rows = sqlx::query(&format!(
        "{} WHERE status<>'archived' ORDER BY updated_at DESC",
        definition_select()
    ))
    .fetch_all(&state.db.pool)
    .await?;
    let definitions = rows
        .iter()
        .map(|row| definition_json(row, &identity, false))
        .collect::<Vec<_>>();
    let workflows = rows
        .iter()
        .map(|row| row.get::<String, _>("workflow_key"))
        .collect::<Vec<_>>();
    let instance_counts =
        sqlx::query("SELECT status,COUNT(*) AS count FROM workflow_instances GROUP BY status")
            .fetch_all(&state.db.pool)
            .await?;
    let mut stats = serde_json::json!({"definitions":definitions.len(),"published":0,"running":0,"waiting":0,"completed":0,"failed":0,"pendingTasks":0});
    stats["published"] = Value::from(
        rows.iter()
            .filter(|row| row.get::<String, _>("status") == "published")
            .count(),
    );
    for row in instance_counts {
        if let Some(target) = stats.get_mut(row.get::<String, _>("status")) {
            *target = Value::from(row.get::<i64, _>("count"));
        }
    }
    stats["pendingTasks"] = Value::from(
        sqlx::query("SELECT COUNT(*) AS count FROM workflow_tasks WHERE status='pending'")
            .fetch_one(&state.db.pool)
            .await?
            .get::<i64, _>("count"),
    );
    let mut users =
        sqlx::query("SELECT id,username,email,role FROM users WHERE is_active=1 ORDER BY username")
            .fetch_all(&state.db.pool)
            .await?
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id":row.get::<String,_>("id"),"username":row.get::<String,_>("username"),
                    "email":row.get::<String,_>("email"),"role":row.get::<String,_>("role")
                })
            })
            .collect::<Vec<_>>();
    if !users.iter().any(|user| user["id"] == identity.sub) {
        users.push(serde_json::json!({"id":identity.sub,"username":identity.username,"email":"","role":identity.role}));
    }
    Ok(Json(
        serde_json::json!({"workflows":workflows,"definitions":definitions,"stats":stats,"users":users,"currentUser":{"id":identity.sub,"username":identity.username,"role":identity.role}}),
    ))
}

#[handler]
async fn get_workflow(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let key = path_value(req, "workflow_id")?;
    let row = find_definition(state, &key).await?;
    Ok(Json(definition_json(&row, &identity, true)))
}

#[handler]
async fn save_workflow(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let key = path_value(req, "workflow_id")?;
    validate_key(&key)?;
    let body = req
        .parse_json::<WorkflowSaveRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    parse_graph(&body.nodes, &body.edges)?;
    let nodes = serde_json::to_string(&body.nodes)
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    let edges = serde_json::to_string(&body.edges)
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    let existing = sqlx::query(&format!("{} WHERE workflow_key=?", definition_select()))
        .bind(&key)
        .fetch_optional(&state.db.pool)
        .await?;
    let (id, version) = if let Some(row) = existing {
        ensure_editable(&row, &identity)?;
        let id = row.get::<String, _>("id");
        let version = row.get::<i64, _>("current_version") + 1;
        sqlx::query("UPDATE workflow_definitions SET name=?,description=?,status='draft',current_version=?,nodes=?,edges=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(optional_text(&body.name).unwrap_or_else(|| row.get::<String,_>("name")))
            .bind(optional_text(&body.description).or_else(|| row.try_get::<String,_>("description").ok()))
            .bind(version).bind(&nodes).bind(&edges).bind(&id).execute(&state.db.pool).await?;
        (id, version)
    } else {
        let id = generate_id();
        let version = 1_i64;
        sqlx::query("INSERT INTO workflow_definitions (id,workflow_key,name,description,status,current_version,nodes,edges,created_by,created_at,updated_at) VALUES (?,?,?,?, 'draft',?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
            .bind(&id).bind(&key).bind(optional_text(&body.name).unwrap_or_else(|| key.clone()))
            .bind(optional_text(&body.description)).bind(version).bind(&nodes).bind(&edges).bind(&identity.sub)
            .execute(&state.db.pool).await?;
        (id, version)
    };
    sqlx::query("INSERT INTO workflow_versions (id,workflow_id,version,nodes,edges,created_by,created_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)")
        .bind(generate_id()).bind(&id).bind(version).bind(nodes).bind(edges).bind(&identity.sub).execute(&state.db.pool).await?;
    Ok(Json(
        serde_json::json!({"ok":true,"id":id,"key":key,"version":version,"status":"draft"}),
    ))
}

#[handler]
async fn publish_workflow(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let key = path_value(req, "workflow_id")?;
    let row = find_definition(state, &key).await?;
    ensure_editable(&row, &identity)?;
    let nodes = serde_json::from_str::<Vec<Value>>(&row.get::<String, _>("nodes"))
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let edges = serde_json::from_str::<Vec<Value>>(&row.get::<String, _>("edges"))
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let graph = parse_graph(&nodes, &edges)?;
    validate_publishable(&graph)?;
    sqlx::query("UPDATE workflow_definitions SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(row.get::<String,_>("id")).execute(&state.db.pool).await?;
    Ok(Json(
        serde_json::json!({"ok":true,"key":key,"status":"published","version":row.get::<i64,_>("current_version")}),
    ))
}

#[handler]
async fn delete_workflow(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let key = path_value(req, "workflow_id")?;
    if key == "default" {
        return Err(AppError::BadRequest(
            "The default workflow cannot be deleted".into(),
        ));
    }
    let row = find_definition(state, &key).await?;
    ensure_editable(&row, &identity)?;
    sqlx::query(
        "UPDATE workflow_definitions SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .bind(row.get::<String, _>("id"))
    .execute(&state.db.pool)
    .await?;
    Ok(Json(serde_json::json!({"ok":true,"archived":true})))
}

fn graph_from_row(row: &AnyRow) -> Result<WorkflowGraph, AppError> {
    let nodes = serde_json::from_str::<Vec<Value>>(&row.get::<String, _>("nodes"))
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let edges = serde_json::from_str::<Vec<Value>>(&row.get::<String, _>("edges"))
        .map_err(|error| AppError::Internal(error.to_string()))?;
    parse_graph(&nodes, &edges)
}

fn eval_context(context: &Value) -> evalexpr::HashMapContext {
    let mut result = evalexpr::HashMapContext::new();
    for section in ["payload", "global"] {
        if let Some(values) = context.get(section).and_then(Value::as_object) {
            for (key, value) in values {
                let converted = match value {
                    Value::Bool(value) => Some(evalexpr::Value::Boolean(*value)),
                    Value::Number(value) if value.is_i64() => {
                        value.as_i64().map(evalexpr::Value::Int)
                    }
                    Value::Number(value) => value.as_f64().map(evalexpr::Value::Float),
                    Value::String(value) => Some(evalexpr::Value::String(value.clone())),
                    _ => None,
                };
                if let Some(value) = converted {
                    let _ = result.set_value(key.clone(), value);
                }
            }
        }
    }
    result
}

fn render_prompt(template: &str, context: &Value) -> String {
    let mut result = template.replace("{{payload}}", &context["payload"].to_string());
    if let Some(global) = context.get("global").and_then(Value::as_object) {
        for (key, value) in global {
            result = result.replace(
                &format!("{{{{global.{key}}}}}"),
                value.as_str().unwrap_or(&value.to_string()),
            );
        }
    }
    result
}

fn next_node(graph: &WorkflowGraph, node: &FlowNode, branch: Option<bool>) -> Option<String> {
    let outgoing = graph
        .edges
        .iter()
        .filter(|edge| edge.source == node.id)
        .collect::<Vec<_>>();
    if node.node_type == "conditionNode" {
        let expected = if branch.unwrap_or(false) {
            "source-right"
        } else {
            "source-bottom"
        };
        outgoing
            .iter()
            .find(|edge| edge.source_handle.as_deref() == Some(expected))
            .or_else(|| outgoing.first())
            .map(|edge| edge.target.clone())
    } else {
        outgoing.first().map(|edge| edge.target.clone())
    }
}

async fn fail_instance(state: &AppState, instance_id: &str, error: &str) {
    let _ = sqlx::query("UPDATE workflow_instances SET status='failed',error_message=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(error).bind(instance_id).execute(&state.db.pool).await;
}

async fn execute_instance(
    state: AppState,
    instance_id: String,
    graph: WorkflowGraph,
    start_node_id: String,
    mut context: Value,
) -> Result<(), AppError> {
    sqlx::query("UPDATE workflow_instances SET status='running',current_node_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(&start_node_id).bind(&instance_id).execute(&state.db.pool).await?;
    let instance =
        sqlx::query("SELECT started_by,started_by_name FROM workflow_instances WHERE id=?")
            .bind(&instance_id)
            .fetch_one(&state.db.pool)
            .await?;
    let started_by = instance.get::<String, _>("started_by");
    let started_by_name = instance.get::<String, _>("started_by_name");
    let mut current_id = start_node_id;
    for _ in 0..500 {
        let Some(node) = graph
            .nodes
            .iter()
            .find(|node| node.id == current_id)
            .cloned()
        else {
            let error = format!("Node {current_id} not found");
            fail_instance(&state, &instance_id, &error).await;
            return Ok(());
        };
        let label = node
            .data
            .get("label")
            .and_then(Value::as_str)
            .unwrap_or(&node.node_type)
            .to_string();
        let step_id = generate_id();
        sqlx::query("INSERT INTO workflow_step_runs (id,instance_id,node_id,node_type,node_label,status,input_data,started_at) VALUES (?,?,?,?,?,'running',?,CURRENT_TIMESTAMP)")
            .bind(&step_id).bind(&instance_id).bind(&node.id).bind(&node.node_type).bind(&label).bind(context.to_string()).execute(&state.db.pool).await?;
        if node.node_type == "basicNode"
            && node.data.get("executionMode").and_then(Value::as_str) == Some("humanTask")
        {
            let assignee_id = node
                .data
                .get("assigneeId")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .unwrap_or(&started_by)
                .to_string();
            let assignee_name = node
                .data
                .get("assigneeName")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
                .unwrap_or(&started_by_name)
                .to_string();
            let due_days = node
                .data
                .get("dueDays")
                .and_then(Value::as_i64)
                .unwrap_or(0)
                .clamp(0, 365);
            let due_date = if due_days > 0 {
                Some(
                    (Utc::now().date_naive() + Duration::days(due_days))
                        .format("%Y-%m-%d")
                        .to_string(),
                )
            } else {
                None
            };
            sqlx::query("INSERT INTO workflow_tasks (id,instance_id,node_id,title,instructions,assignee_id,assignee_name,status,due_date,form_data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,'{}',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
                .bind(generate_id()).bind(&instance_id).bind(&node.id).bind(&label).bind(node.data.get("prompt").and_then(Value::as_str))
                .bind(&assignee_id).bind(&assignee_name).bind(due_date).execute(&state.db.pool).await?;
            sqlx::query("UPDATE workflow_step_runs SET status='waiting',output_data=?,completed_at=NULL WHERE id=?").bind("{\"waitingForHuman\":true}").bind(&step_id).execute(&state.db.pool).await?;
            sqlx::query("UPDATE workflow_instances SET status='waiting',current_node_id=?,context_data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
                .bind(&node.id).bind(context.to_string()).bind(&instance_id).execute(&state.db.pool).await?;
            return Ok(());
        }
        let execution = execute_node(&state, &node, &mut context).await;
        let (output, branch) = match execution {
            Ok(value) => value,
            Err(error) => {
                sqlx::query("UPDATE workflow_step_runs SET status='failed',error_message=?,completed_at=CURRENT_TIMESTAMP WHERE id=?")
                    .bind(error.to_string()).bind(&step_id).execute(&state.db.pool).await?;
                fail_instance(&state, &instance_id, &error.to_string()).await;
                return Ok(());
            }
        };
        sqlx::query("UPDATE workflow_step_runs SET status='completed',output_data=?,completed_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(output.to_string()).bind(&step_id).execute(&state.db.pool).await?;
        if node.node_type == "endNode" || next_node(&graph, &node, branch).is_none() {
            sqlx::query("UPDATE workflow_instances SET status='completed',context_data=?,current_node_id=NULL,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
                .bind(context.to_string()).bind(&instance_id).execute(&state.db.pool).await?;
            return Ok(());
        }
        current_id = next_node(&graph, &node, branch).unwrap();
        sqlx::query("UPDATE workflow_instances SET current_node_id=?,context_data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
            .bind(&current_id).bind(context.to_string()).bind(&instance_id).execute(&state.db.pool).await?;
    }
    fail_instance(
        &state,
        &instance_id,
        "Workflow exceeded the 500-step safety limit",
    )
    .await;
    Ok(())
}

async fn execute_node(
    state: &AppState,
    node: &FlowNode,
    context: &mut Value,
) -> Result<(Value, Option<bool>), AppError> {
    fn set_payload(context: &mut Value, key: String, value: Value) -> Result<(), AppError> {
        context
            .get_mut("payload")
            .and_then(Value::as_object_mut)
            .ok_or_else(|| AppError::Internal("Workflow payload context is invalid".into()))?
            .insert(key, value);
        Ok(())
    }
    match node.node_type.as_str() {
        "variableNode" => {
            let name = node
                .data
                .get("varName")
                .and_then(Value::as_str)
                .unwrap_or("");
            let raw = node
                .data
                .get("varValue")
                .and_then(Value::as_str)
                .unwrap_or("");
            let rendered = render_prompt(raw, context);
            let value = serde_json::from_str(&rendered).unwrap_or(Value::String(rendered));
            context
                .get_mut("global")
                .and_then(Value::as_object_mut)
                .unwrap()
                .insert(name.to_string(), value.clone());
            Ok((value, None))
        }
        "calculateNode" => {
            let expression = node
                .data
                .get("expression")
                .and_then(Value::as_str)
                .unwrap_or("");
            let value = evalexpr::eval_with_context(expression, &eval_context(context))
                .map_err(|error| AppError::Internal(format!("Calculation failed: {error}")))?;
            let json = match value {
                evalexpr::Value::Int(v) => Value::from(v),
                evalexpr::Value::Float(v) => Value::from(v),
                evalexpr::Value::Boolean(v) => Value::from(v),
                evalexpr::Value::String(v) => Value::from(v),
                _ => Value::Null,
            };
            set_payload(context, format!("{}_calc_result", node.id), json.clone())?;
            Ok((json, None))
        }
        "conditionNode" => {
            let expression = node
                .data
                .get("condition")
                .and_then(Value::as_str)
                .unwrap_or("");
            let result = evalexpr::eval_boolean_with_context(expression, &eval_context(context))
                .map_err(|error| AppError::Internal(format!("Condition failed: {error}")))?;
            set_payload(
                context,
                format!("{}_condition_result", node.id),
                Value::Bool(result),
            )?;
            Ok((Value::Bool(result), Some(result)))
        }
        "agentNode" => {
            let prompt = render_prompt(
                node.data
                    .get("prompt")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
                context,
            );
            let llm = LLMService::new(
                state.config.openai_api_key.as_deref(),
                &state.config.openai_base_url,
            );
            let answer = llm.generate_with_messages(&[serde_json::json!({"role":"system","content":"You are an AI agent executing a governed Cortex workflow."}),serde_json::json!({"role":"user","content":format!("{}\n\nWorkflow context: {}",prompt,context)})]).await
                .map_err(|error| AppError::Internal(format!("Agent execution failed: {error}")))?;
            set_payload(
                context,
                format!("{}_result", node.id),
                Value::String(answer.clone()),
            )?;
            Ok((Value::String(answer), None))
        }
        "toolNode" => {
            let tool = node
                .data
                .get("toolType")
                .and_then(Value::as_str)
                .unwrap_or("");
            let parameters = render_prompt(
                node.data
                    .get("parameters")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
                context,
            );
            let value = if tool == "calculator" {
                let expression = serde_json::from_str::<Value>(&parameters)
                    .ok()
                    .and_then(|value| {
                        value
                            .get("expression")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .unwrap_or(parameters);
                let result = evalexpr::eval(&expression)
                    .map_err(|error| AppError::Internal(format!("Calculator failed: {error}")))?;
                Value::String(result.to_string())
            } else {
                Value::String(format!("Connector '{tool}' accepted parameters; configure its governed executor to perform external I/O: {parameters}"))
            };
            set_payload(context, format!("{}_result", node.id), value.clone())?;
            Ok((value, None))
        }
        "skillNode" | "mcpNode" => {
            let value = Value::String(format!(
                "{} queued through the Cortex integration adapter",
                node.node_type
            ));
            set_payload(context, format!("{}_result", node.id), value.clone())?;
            Ok((value, None))
        }
        "basicNode" => {
            let value = Value::String(render_prompt(
                node.data
                    .get("prompt")
                    .and_then(Value::as_str)
                    .unwrap_or(""),
                context,
            ));
            set_payload(context, format!("{}_result", node.id), value.clone())?;
            Ok((value, None))
        }
        _ => Ok((serde_json::json!({"ok":true}), None)),
    }
}

#[handler]
async fn run_workflow(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let key = path_value(req, "workflow_id")?;
    let row = find_definition(state, &key).await?;
    if row.get::<String, _>("status") != "published" {
        return Err(AppError::BadRequest(
            "Publish the workflow before running it".into(),
        ));
    }
    let graph = graph_from_row(&row)?;
    validate_publishable(&graph)?;
    let input = req
        .parse_json::<Value>()
        .await
        .unwrap_or_else(|_| serde_json::json!({}));
    if !input.is_object() {
        return Err(AppError::BadRequest(
            "Workflow input must be a JSON object".into(),
        ));
    }
    let instance_id = generate_id();
    let context = serde_json::json!({"payload":input,"global":{}});
    sqlx::query("INSERT INTO workflow_instances (id,workflow_id,workflow_key,version,status,input_data,context_data,started_by,started_by_name,started_at,updated_at) VALUES (?,?,?,?, 'queued',?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(&instance_id).bind(row.get::<String,_>("id")).bind(&key).bind(row.get::<i64,_>("current_version"))
        .bind(context["payload"].to_string()).bind(context.to_string()).bind(&identity.sub).bind(&identity.username).execute(&state.db.pool).await?;
    let start = graph
        .nodes
        .iter()
        .find(|node| node.node_type == "startNode")
        .unwrap()
        .id
        .clone();
    let task_state = state.clone();
    let task_instance = instance_id.clone();
    tokio::spawn(async move {
        if let Err(error) = execute_instance(
            task_state.clone(),
            task_instance.clone(),
            graph,
            start,
            context,
        )
        .await
        {
            fail_instance(&task_state, &task_instance, &error.to_string()).await;
        }
    });
    Ok(Json(
        serde_json::json!({"ok":true,"message":"工作流程已排入執行","instanceId":instance_id,"status":"queued"}),
    ))
}

#[handler]
async fn list_instances(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let all = req.query::<bool>("all").unwrap_or(false) && identity.role == "admin";
    let rows = if all {
        sqlx::query("SELECT id,workflow_id,workflow_key,version,status,input_data,context_data,current_node_id,started_by,started_by_name,CAST(started_at AS TEXT) AS started_at,CAST(updated_at AS TEXT) AS updated_at,completed_at,error_message FROM workflow_instances ORDER BY started_at DESC LIMIT 200").fetch_all(&state.db.pool).await?
    } else {
        sqlx::query("SELECT id,workflow_id,workflow_key,version,status,input_data,context_data,current_node_id,started_by,started_by_name,CAST(started_at AS TEXT) AS started_at,CAST(updated_at AS TEXT) AS updated_at,completed_at,error_message FROM workflow_instances WHERE started_by=? OR EXISTS (SELECT 1 FROM workflow_tasks t WHERE t.instance_id=workflow_instances.id AND t.assignee_id=?) ORDER BY started_at DESC LIMIT 200").bind(&identity.sub).bind(&identity.sub).fetch_all(&state.db.pool).await?
    };
    Ok(Json(
        serde_json::json!({"instances":rows.iter().map(instance_json).collect::<Vec<_>>()}),
    ))
}

#[handler]
async fn get_instance(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_value(req, "instance_id")?;
    let row=sqlx::query("SELECT id,workflow_id,workflow_key,version,status,input_data,context_data,current_node_id,started_by,started_by_name,CAST(started_at AS TEXT) AS started_at,CAST(updated_at AS TEXT) AS updated_at,completed_at,error_message FROM workflow_instances WHERE id=?").bind(&id).fetch_optional(&state.db.pool).await?.ok_or_else(||AppError::NotFound("Workflow instance not found".into()))?;
    let accessible = identity.role == "admin"
        || row.get::<String, _>("started_by") == identity.sub
        || sqlx::query("SELECT id FROM workflow_tasks WHERE instance_id=? AND assignee_id=?")
            .bind(&id)
            .bind(&identity.sub)
            .fetch_optional(&state.db.pool)
            .await?
            .is_some();
    if !accessible {
        return Err(AppError::Unauthorized(
            "Workflow instance access denied".into(),
        ));
    }
    let steps=sqlx::query("SELECT id,node_id,node_type,node_label,status,input_data,output_data,error_message,CAST(started_at AS TEXT) AS started_at,completed_at FROM workflow_step_runs WHERE instance_id=? ORDER BY started_at").bind(&id).fetch_all(&state.db.pool).await?.into_iter().map(|step|serde_json::json!({"id":step.get::<String,_>("id"),"nodeId":step.get::<String,_>("node_id"),"nodeType":step.get::<String,_>("node_type"),"nodeLabel":step.get::<String,_>("node_label"),"status":step.get::<String,_>("status"),"output":step.try_get::<String,_>("output_data").ok().and_then(|value|serde_json::from_str::<Value>(&value).ok()),"errorMessage":step.try_get::<String,_>("error_message").ok(),"startedAt":step.try_get::<String,_>("started_at").ok(),"completedAt":step.try_get::<String,_>("completed_at").ok()})).collect::<Vec<_>>();
    let tasks=sqlx::query("SELECT id,instance_id,node_id,title,instructions,assignee_id,assignee_name,status,due_date,form_data,decision_comment,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at,completed_at FROM workflow_tasks WHERE instance_id=? ORDER BY created_at").bind(&id).fetch_all(&state.db.pool).await?.iter().map(task_json).collect::<Vec<_>>();
    Ok(Json(
        serde_json::json!({"instance":instance_json(&row),"steps":steps,"tasks":tasks}),
    ))
}

#[handler]
async fn list_tasks(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let all = req.query::<bool>("all").unwrap_or(false) && identity.role == "admin";
    let rows = if all {
        sqlx::query("SELECT id,instance_id,node_id,title,instructions,assignee_id,assignee_name,status,due_date,form_data,decision_comment,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at,completed_at FROM workflow_tasks ORDER BY created_at DESC LIMIT 200").fetch_all(&state.db.pool).await?
    } else {
        sqlx::query("SELECT id,instance_id,node_id,title,instructions,assignee_id,assignee_name,status,due_date,form_data,decision_comment,CAST(created_at AS TEXT) AS created_at,CAST(updated_at AS TEXT) AS updated_at,completed_at FROM workflow_tasks WHERE assignee_id=? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 200").bind(&identity.sub).fetch_all(&state.db.pool).await?
    };
    Ok(Json(
        serde_json::json!({"tasks":rows.iter().map(task_json).collect::<Vec<_>>()}),
    ))
}

#[handler]
async fn decide_task(depot: &mut Depot, req: &mut Request) -> Result<Json<Value>, AppError> {
    let state = depot.obtain::<AppState>().unwrap();
    let identity = authentication(req, state)?;
    let id = path_value(req, "task_id")?;
    let body = req
        .parse_json::<TaskDecisionRequest>()
        .await
        .map_err(|error| AppError::BadRequest(error.to_string()))?;
    if !TASK_ACTIONS.contains(&body.action.as_str()) {
        return Err(AppError::BadRequest(
            "Task action must be approved or rejected".into(),
        ));
    }
    let task = sqlx::query(
        "SELECT id,instance_id,node_id,assignee_id,status FROM workflow_tasks WHERE id=?",
    )
    .bind(&id)
    .fetch_optional(&state.db.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Workflow task not found".into()))?;
    if identity.role != "admin" && task.get::<String, _>("assignee_id") != identity.sub {
        return Err(AppError::Unauthorized(
            "Only the assignee can decide this task".into(),
        ));
    }
    if task.get::<String, _>("status") != "pending" {
        return Err(AppError::BadRequest(
            "Workflow task has already been decided".into(),
        ));
    }
    sqlx::query("UPDATE workflow_tasks SET status=?,decision_comment=?,form_data=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(&body.action).bind(optional_text(&body.comment)).bind(body.form_data.unwrap_or_else(||serde_json::json!({})).to_string()).bind(&id).execute(&state.db.pool).await?;
    let instance_id = task.get::<String, _>("instance_id");
    let node_id = task.get::<String, _>("node_id");
    if body.action == "rejected" {
        fail_instance(state, &instance_id, "Human task was rejected").await;
    } else {
        sqlx::query("UPDATE workflow_step_runs SET status='completed',output_data=?,completed_at=CURRENT_TIMESTAMP WHERE instance_id=? AND node_id=? AND status='waiting'").bind("{\"approved\":true}").bind(&instance_id).bind(&node_id).execute(&state.db.pool).await?;
        let instance =
            sqlx::query("SELECT workflow_id,context_data FROM workflow_instances WHERE id=?")
                .bind(&instance_id)
                .fetch_one(&state.db.pool)
                .await?;
        let definition = sqlx::query(&format!("{} WHERE id=?", definition_select()))
            .bind(instance.get::<String, _>("workflow_id"))
            .fetch_one(&state.db.pool)
            .await?;
        let graph = graph_from_row(&definition)?;
        let current = graph
            .nodes
            .iter()
            .find(|node| node.id == node_id)
            .ok_or_else(|| AppError::Internal("Workflow task node is missing".into()))?;
        if let Some(next) = next_node(&graph, current, None) {
            let context = serde_json::from_str::<Value>(&instance.get::<String, _>("context_data"))
                .unwrap_or_else(|_| serde_json::json!({"payload":{},"global":{}}));
            let task_state = state.clone();
            let task_instance = instance_id.clone();
            tokio::spawn(async move {
                if let Err(error) = execute_instance(
                    task_state.clone(),
                    task_instance.clone(),
                    graph,
                    next,
                    context,
                )
                .await
                {
                    fail_instance(&task_state, &task_instance, &error.to_string()).await;
                }
            });
        } else {
            sqlx::query("UPDATE workflow_instances SET status='completed',current_node_id=NULL,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(&instance_id).execute(&state.db.pool).await?;
        }
    }
    Ok(Json(
        serde_json::json!({"ok":true,"taskId":id,"status":body.action}),
    ))
}

pub fn router() -> Router {
    Router::new()
        .push(Router::with_path("workflows").get(list_workflows))
        .push(
            Router::with_path("workflow")
                .push(Router::with_path("instances").get(list_instances))
                .push(Router::with_path("instances/<instance_id>").get(get_instance))
                .push(Router::with_path("tasks").get(list_tasks))
                .push(Router::with_path("tasks/<task_id>").put(decide_task))
                .push(
                    Router::with_path("<workflow_id>")
                        .get(get_workflow)
                        .post(save_workflow)
                        .delete(delete_workflow)
                        .push(Router::with_path("publish").post(publish_workflow))
                        .push(Router::with_path("run").post(run_workflow)),
                ),
        )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_publishable_graph() {
        let nodes = vec![
            serde_json::json!({"id":"start","type":"startNode","data":{}}),
            serde_json::json!({"id":"end","type":"endNode","data":{}}),
        ];
        let edges = vec![serde_json::json!({"id":"edge","source":"start","target":"end"})];
        assert!(validate_publishable(&parse_graph(&nodes, &edges).unwrap()).is_ok());
    }
    #[test]
    fn rejects_unreachable_execution_node() {
        let nodes = vec![
            serde_json::json!({"id":"start","type":"startNode","data":{}}),
            serde_json::json!({"id":"end","type":"endNode","data":{}}),
            serde_json::json!({"id":"agent","type":"agentNode","data":{}}),
        ];
        let edges = vec![serde_json::json!({"source":"start","target":"end"})];
        assert!(validate_publishable(&parse_graph(&nodes, &edges).unwrap()).is_err());
    }

    #[test]
    fn rejects_cycles() {
        let nodes = vec![
            serde_json::json!({"id":"start","type":"startNode","data":{}}),
            serde_json::json!({"id":"condition","type":"conditionNode","data":{}}),
            serde_json::json!({"id":"work","type":"basicNode","data":{}}),
            serde_json::json!({"id":"end","type":"endNode","data":{}}),
        ];
        let edges = vec![
            serde_json::json!({"source":"start","target":"condition"}),
            serde_json::json!({"source":"condition","sourceHandle":"source-right","target":"work"}),
            serde_json::json!({"source":"condition","sourceHandle":"source-bottom","target":"end"}),
            serde_json::json!({"source":"work","target":"condition"}),
        ];
        assert!(validate_publishable(&parse_graph(&nodes, &edges).unwrap()).is_err());
    }
}
