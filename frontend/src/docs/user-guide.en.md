# Cortex User Guide

Version: Updated with the installed Cortex release  
Audience: End users, department managers, knowledge managers, and system administrators

## 1. Sign-in and navigation

1. Open Cortex and enter your username and password.
2. The first left column contains the main areas. The second column contains functions in the selected area.
3. Cortex uses Hash URLs. Refreshing the page or opening a bookmark preserves the requested function.
4. Permission errors are shown in context and do not redirect users to unrelated pages.

## 2. System Job Tabs

- Opening a function adds a tab to the System Jobs area.
- Select a tab to switch work.
- Select × to close a job.
- Right-click a tab to close that job or close all other jobs.
- Tabs are stored per signed-in user and restored after refresh.

## 3. Top quick actions

### AI Prompt

1. Select the AI Prompt icon in the top toolbar.
2. Enter the task that Codex should perform.
3. Select Run to see connection status, execution steps, stdout, stderr, and the final result in real time.
4. Select Cancel Job to stop a running task.
5. Codex runs inside the configured system workspace. This function is restricted to administrators.

### User guide

- Select the Help icon to open this guide.
- Switch between English and Traditional Chinese in the dialog.

### Real-time communication

- Select the communication icon to open Team Collaboration → Channels & Messages.
- Switch workspaces and channels, send messages, reply in threads, react, and search messages.

## 4. Workspace and dashboard

### AI Document Query

1. Enter a question or analysis request.
2. Select one or more documents from the document tree.
3. Run the query to retrieve relevant passages and synthesize information across documents.
4. Select a document to preview Markdown, PDF, Word, Excel, or PowerPoint content.

### Overview, health, and activity

- Overview summarizes documents, indexing, retrieval, collaboration, and graph activity.
- System Health reports database, Qdrant, model services, and document processing status.
- Recent Activity combines document, search, research, issue, and collaboration events.

## 5. Department Workspaces

Cortex includes CEO, CFO, CTO, Sales, Administration, Human Resources, Procurement, MIS, Sales Delivery Projects, IT Projects, and Information Security workspaces.

- Every workspace has an independent URL, metrics, and work-item types.
- Create, edit, delete, search, and filter work items by status or type.
- Creators and administrators can edit or delete items.
- CFO, Sales, Procurement, and selected project modules support working amounts.

## 6. Project Management

- Project Information creates and maintains project metadata, manager, schedule, budget, and links. Creating a project also creates its collaboration channel.
- Gantt Chart shows tasks and milestones on a timeline. Select a bar to edit the item.
- Milestones manages important gates, deliverables, owners, and due dates.
- Kanban Work supports dragging tasks between Backlog, To Do, In Progress, Review, and Done.
- Project Budget tracks planned, approved, committed, and spent amounts with a utilization indicator.
- Project People manages roles and allocation. Adding a member also adds that user to the project channel.
- Requirements stores sources, acceptance criteria, status, priority, and progress.
- Delivery Audits stores evidence, findings, results, and follow-up work.
- Use the Project selector at the top of each screen. The `project` URL parameter preserves the current project.
- Project changes are posted to the matching channel under Team Collaboration → Project Collaboration.

## 7. Workflow Management

- Workflow Overview summarizes definitions, published workflows, running/waiting/failed instances, and pending tasks.
- Workflow Designer integrates `eiva-fe-workflow` with draggable Start, AI Agent, Tool, Skill, MCP, Variable, Calculation, Condition, Human Task, End, Swimlane, and Note nodes.
- Save a draft to create an immutable version, then Publish to run structural validation. Only published workflows can run.
- A Condition node uses its right connector for true and bottom connector for false. Calculations and conditions can use scalar Payload fields.
- Set a Basic Work node to Human Task / Approval, then select an assignee and due period. The instance pauses and appears in My Workflow Tasks.
- Approving a task resumes execution at the next node. Rejecting it stops the instance while preserving the reason and audit trail.
- Definitions & Versions supports designing, publishing, running, and archiving. Archiving preserves versions and execution audits.
- Workflow Instances shows input, output, and step history. Execution Monitoring refreshes active and failed instances every five seconds.
- External I/O tools, Skills, and MCP nodes run through governed Cortex adapters. An unconfigured connector never performs direct external I/O.

## 8. Personal Workspace

- Following manages bookmarked and monitored documents.
- My Reviews lists reviews waiting for the current user.
- Contributions & Points shows personal knowledge contributions.
- My Project Work summarizes participating projects, assigned tasks, upcoming milestones, and pending audits.

## 9. AI Chat and Team Collaboration

### AI Chat

- Start a conversation and ask questions grounded in the knowledge base.
- Use Chat History to return to previous work contexts.

### Channels and messages

- Create workspaces and public or private channels.
- Manage members, real-time messages, threads, and reactions.
- If WebSocket communication disconnects, verify backend and network status.

### Issue tracking

- Create issues with status, priority, assignee, and due date.
- Add comments, inspect history, and use Issues Assigned to Me to track personal work.

### Project collaboration

- Lists projects and their automatically managed channels.
- Open the exact project channel or return to project information. Project changes notify channel users through WebSocket.

## 10. Documents and content

### Working directories

- Use the add button beside Root to create a directory.
- Refresh, copy, or delete a directory with its action icons. Deletion requires confirmation.
- Selecting a directory makes it the current upload and working directory.

### Uploading documents

1. Select a working directory.
2. Upload Markdown, PDF, DOCX, XLSX, or PPTX files.
3. Office and PDF files are converted to Markdown before PageIndex, chunking, embedding, and vector indexing.
4. gRPC-over-WebSocket events show every processing stage and result.

### Content management

- Create Markdown, web, or database SQL content.
- SQL results are converted to Markdown before indexing.
- Each edit creates a version and may enable RAG and PageIndex.
- Use the delete icon beside a document to remove it.

## 11. Search, Knowledge Center, and Knowledge Graph

- Full-text Search uses textual conditions.
- Hybrid Search combines keywords with vector semantics.
- Knowledge Center manages documents, categories, drafts, reviews, FAQs, experts, and community ratings.
- Knowledge Graph visualizes document and concept relationships. Community and isolated-node views help improve knowledge connectivity.

## 12. Deep Research and AI Models

- Deep Research runs multi-step research tasks and preserves their history.
- AI Models tests Embedding and Reranking endpoints.
- Indexing tools run GitNexus or Graphify while streaming output.

## 13. System Settings

### Language and theme

- Use the top-right controls to switch light/dark theme and Traditional Chinese/English.

### System parameters

- Administrators maintain Embedding, Reranking, and PageIndex models and API base URLs.
- API keys are configured only through backend environment variables or secret management and are never displayed in the UI.
- Administrators maintain the footer contact and common links. Links must use HTTP or HTTPS.
- Model settings require a backend restart. Footer settings update immediately.

### Organization and system administration

- The left side of `topToolArea` displays “Company / Department / account: name-title: permission === active project : document directory”. It updates when the active project or directory changes.
- User, Department, Role, Permission, and About management maintain the organization and identity values shown there. Role permission codes are comma-separated; `*` grants full access.
- Menu Management controls main-category visibility and ordering. Administrators retain access to System Settings to prevent accidental lockout.
- Enterprise Systems, AI Models, Contexts, Channels, Schedules, AI Providers, Auto-Approve, Auto complete, Notification, Commit Message, Sandbox, Languages, and About all provide paginated grids, live cross-field search, create, edit, and delete operations.
- AI Provider records store only a secret name or secret-manager reference; never enter a plaintext API key in the settings data.

## 14. Footer information

The bottom area shows copyright, system version, support contact, and common links. Select an email, phone number, or link to open the appropriate application.

## 15. Troubleshooting

- **Returned to sign-in after login:** Clear an expired session, sign in again, and verify matching backend JWT settings.
- **A document remains Processing:** Check System Health and upload events, then verify Embedding, PageIndex, and Qdrant services.
- **AI Prompt is unavailable:** The function is administrator-only. Verify that the backend can run `codex` and that Codex is authenticated.
- **Real-time messages disconnect:** Verify the WebSocket proxy, backend connectivity, and login token.
- **Settings cannot be saved:** Only administrators can edit settings. Model endpoints and common links must use HTTP or HTTPS.
- **The top user context shows “not configured”:** Complete company, department, name, and title under System Settings → User Management, and verify that the assigned role is active.

## 16. Security guidance

- Do not paste passwords, API keys, tokens, or sensitive personal data into messages, prompts, or documents.
- AI Prompt can operate on the configured workspace. Review the task scope and expected changes before running it.
- Confirm targets and impact before deleting documents, directories, work items, or issues.
- Continue to follow organizational access policies for private channels and department information.
