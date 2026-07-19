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

## 6. Personal Workspace

- Following manages bookmarked and monitored documents.
- My Reviews lists reviews waiting for the current user.
- Contributions & Points shows personal knowledge contributions.

## 7. AI Chat and Team Collaboration

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

## 8. Documents and content

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

## 9. Search, Knowledge Center, and Knowledge Graph

- Full-text Search uses textual conditions.
- Hybrid Search combines keywords with vector semantics.
- Knowledge Center manages documents, categories, drafts, reviews, FAQs, experts, and community ratings.
- Knowledge Graph visualizes document and concept relationships. Community and isolated-node views help improve knowledge connectivity.

## 10. Deep Research and AI Models

- Deep Research runs multi-step research tasks and preserves their history.
- AI Models tests Embedding and Reranking endpoints.
- Indexing tools run GitNexus or Graphify while streaming output.

## 11. System Settings

### Language and theme

- Use the top-right controls to switch light/dark theme and Traditional Chinese/English.

### System parameters

- Administrators maintain Embedding, Reranking, and PageIndex models and API base URLs.
- API keys are configured only through backend environment variables or secret management and are never displayed in the UI.
- Administrators maintain the footer contact and common links. Links must use HTTP or HTTPS.
- Model settings require a backend restart. Footer settings update immediately.

## 12. Footer information

The bottom area shows copyright, system version, support contact, and common links. Select an email, phone number, or link to open the appropriate application.

## 13. Troubleshooting

- **Returned to sign-in after login:** Clear an expired session, sign in again, and verify matching backend JWT settings.
- **A document remains Processing:** Check System Health and upload events, then verify Embedding, PageIndex, and Qdrant services.
- **AI Prompt is unavailable:** The function is administrator-only. Verify that the backend can run `codex` and that Codex is authenticated.
- **Real-time messages disconnect:** Verify the WebSocket proxy, backend connectivity, and login token.
- **Settings cannot be saved:** Only administrators can edit settings. Model endpoints and common links must use HTTP or HTTPS.

## 14. Security guidance

- Do not paste passwords, API keys, tokens, or sensitive personal data into messages, prompts, or documents.
- AI Prompt can operate on the configured workspace. Review the task scope and expected changes before running it.
- Confirm targets and impact before deleting documents, directories, work items, or issues.
- Continue to follow organizational access policies for private channels and department information.

