import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  type Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  LayoutGrid,
  Type,
  TextCursorInput,
  ToggleLeft,
  List,
  Table2,
  SquareStack,
  SeparatorHorizontal,
  Image,
  Tag,
  Calendar,
  Upload,
  Save,
  Eye,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Settings2,
  ChevronRight,
  MousePointerClick,
  BarChart3,
  CreditCard,
  FileText,
  Mail,
  Phone,
  Hash,
  Box,
} from 'lucide-react';
import CommonHeroTitle from '../components/common/CommonHeroTitle';
import toast from 'react-hot-toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ComponentItem {
  type: string;
  label: string;
  icon: typeof Type;
  category: 'basic' | 'form' | 'layout' | 'data';
}

interface ScreenNode extends Node {
  data: {
    label: string;
    componentType: string;
    props: Record<string, string>;
  };
}

interface ScreenEdge extends Edge {}

interface HistoryEntry {
  nodes: ScreenNode[];
  edges: ScreenEdge[];
}

/* ------------------------------------------------------------------ */
/*  Component Palette                                                  */
/* ------------------------------------------------------------------ */

const componentPalette: ComponentItem[] = [
  { type: 'text', label: '文字標籤', icon: Type, category: 'basic' },
  { type: 'heading', label: '標題', icon: Tag, category: 'basic' },
  { type: 'paragraph', label: '段落文字', icon: FileText, category: 'basic' },
  { type: 'image', label: '圖片', icon: Image, category: 'basic' },
  { type: 'separator', label: '分隔線', icon: SeparatorHorizontal, category: 'layout' },
  { type: 'card', label: '卡片容器', icon: CreditCard, category: 'layout' },
  { type: 'columns', label: '多欄佈局', icon: SquareStack, category: 'layout' },
  { type: 'textInput', label: '文字輸入', icon: TextCursorInput, category: 'form' },
  { type: 'textarea', label: '多行輸入', icon: TextCursorInput, category: 'form' },
  { type: 'select', label: '下拉選單', icon: List, category: 'form' },
  { type: 'checkbox', label: '勾選框', icon: ToggleLeft, category: 'form' },
  { type: 'datepicker', label: '日期選擇', icon: Calendar, category: 'form' },
  { type: 'fileupload', label: '檔案上傳', icon: Upload, category: 'form' },
  { type: 'button', label: '按鈕', icon: MousePointerClick, category: 'form' },
  { type: 'table', label: '資料表格', icon: Table2, category: 'data' },
  { type: 'chart', label: '圖表', icon: BarChart3, category: 'data' },
  { type: 'email', label: '電子郵件', icon: Mail, category: 'form' },
  { type: 'phone', label: '電話', icon: Phone, category: 'form' },
  { type: 'number', label: '數字輸入', icon: Hash, category: 'form' },
];

const categories = [
  { key: 'basic', label: '基礎元件' },
  { key: 'layout', label: '佈局元件' },
  { key: 'form', label: '表單元件' },
  { key: 'data', label: '資料元件' },
] as const;

/* ------------------------------------------------------------------ */
/*  Custom Node Component                                              */
/* ------------------------------------------------------------------ */

function ScreenNodeComponent({ data, selected }: { data: ScreenNode['data']; selected?: boolean }) {
  const iconMap: Record<string, typeof Type> = {
    text: Type, heading: Tag, paragraph: FileText, image: Image,
    separator: SeparatorHorizontal, card: CreditCard, columns: SquareStack,
    textInput: TextCursorInput, textarea: TextCursorInput, select: List,
    checkbox: ToggleLeft, datepicker: Calendar, fileupload: Upload,
    button: MousePointerClick, table: Table2, chart: BarChart3,
    email: Mail, phone: Phone, number: Hash,
  };
  const Icon = iconMap[data.componentType] || Box;

  const renderPreview = () => {
    switch (data.componentType) {
      case 'text':
      case 'heading':
        return <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{data.props.text || data.label}</p>;
      case 'paragraph':
        return <p className="text-xs text-gray-500">{data.props.text || '段落文字內容...'}</p>;
      case 'button':
        return <button className="rounded bg-primary-600 px-3 py-1 text-xs text-white">{data.props.label || '按鈕'}</button>;
      case 'textInput':
        return <input className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" placeholder={data.props.placeholder || '請輸入...'} readOnly />;
      case 'textarea':
        return <textarea className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" placeholder={data.props.placeholder || '請輸入...'} rows={3} readOnly />;
      case 'select':
        return <select className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" disabled><option>{data.props.placeholder || '請選擇...'}</option></select>;
      case 'checkbox':
        return <label className="flex items-center gap-2 text-xs"><input type="checkbox" readOnly />{data.props.label || '勾選項目'}</label>;
      case 'datepicker':
        return <input type="date" className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" readOnly />;
      case 'fileupload':
        return <div className="rounded border-2 border-dashed border-gray-300 p-3 text-center text-xs text-gray-400 dark:border-gray-600">點擊或拖曳以上傳檔案</div>;
      case 'table':
        return (
          <div className="overflow-hidden rounded border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-2 py-1">欄位 A</th><th className="px-2 py-1">欄位 B</th></tr></thead>
            <tbody><tr className="border-t dark:border-gray-700"><td className="px-2 py-1">—</td><td className="px-2 py-1">—</td></tr></tbody></table>
          </div>
        );
      case 'chart':
        return <div className="flex h-20 items-center justify-center rounded bg-gray-50 text-xs text-gray-400 dark:bg-gray-700">圖表預覽區</div>;
      case 'image':
        return <div className="flex h-16 items-center justify-center rounded bg-gray-50 text-xs text-gray-400 dark:bg-gray-700">圖片預覽</div>;
      case 'separator':
        return <hr className="border-gray-300 dark:border-gray-600" />;
      case 'card':
        return <div className="rounded border border-gray-200 p-2 text-xs text-gray-500 dark:border-gray-700">卡片容器</div>;
      case 'columns':
        return <div className="flex gap-2 text-xs"><div className="flex-1 rounded bg-gray-50 p-2 text-center text-gray-400 dark:bg-gray-700">欄 1</div><div className="flex-1 rounded bg-gray-50 p-2 text-center text-gray-400 dark:bg-gray-700">欄 2</div></div>;
      case 'email':
        return <input type="email" className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" placeholder="example@mail.com" readOnly />;
      case 'phone':
        return <input type="tel" className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" placeholder="0912-345-678" readOnly />;
      case 'number':
        return <input type="number" className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700" placeholder="0" readOnly />;
      default:
        return <p className="text-xs text-gray-500">{data.label}</p>;
    }
  };

  return (
    <div className={`min-w-[180px] rounded-lg border-2 bg-white shadow-sm dark:bg-gray-800 ${selected ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-750">
        <Icon className="h-3.5 w-3.5 text-primary-600" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{data.label}</span>
      </div>
      <div className="p-2">{renderPreview()}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Designer Component (inside ReactFlowProvider)                 */
/* ------------------------------------------------------------------ */

function ScreenDesignerInner() {
  const { screenToFlowPosition, setNodes, setEdges } = useReactFlow();
  const [nodes, setNodesState] = useState<ScreenNode[]>([]);
  const [edges, setEdgesState] = useState<ScreenEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<ScreenNode | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([{ nodes: [], edges: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [screenName, setScreenName] = useState('未命名畫面');
  const [showProperties, setShowProperties] = useState(true);
  const dragRef = useRef<string | null>(null);
  const nodeIdCounter = useRef(0);

  const nodeTypes: NodeTypes = { screenNode: ScreenNodeComponent as never };

  const saveToHistory = useCallback((newNodes: ScreenNode[], newEdges: ScreenEdge[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIndex + 1);
      return [...truncated, { nodes: newNodes, edges: newEdges }];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodesState(prev.nodes);
    setEdgesState(prev.edges);
    setHistoryIndex((i) => i - 1);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodesState(next.nodes);
    setEdgesState(next.edges);
    setHistoryIndex((i) => i + 1);
  }, [history, historyIndex]);

  const onNodesChange: OnNodesChange<ScreenNode> = useCallback((changes) => {
    setNodesState((nds) => {
      const updated = applyNodeChanges(changes, nds) as ScreenNode[];
      return updated;
    });
  }, []);

  const onEdgesChange: OnEdgesChange<ScreenEdge> = useCallback((changes) => {
    setEdgesState((eds) => {
      const updated = applyEdgeChanges(changes, eds) as ScreenEdge[];
      return updated;
    });
  }, []);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    setEdgesState((eds) => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
      style: { strokeWidth: 2 },
    }, eds) as ScreenEdge[]);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as ScreenNode);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const componentType = dragRef.current;
    if (!componentType) return;

    const item = componentPalette.find((c) => c.type === componentType);
    if (!item) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const id = `node-${++nodeIdCounter.current}`;
    const newNode: ScreenNode = {
      id,
      type: 'screenNode',
      position,
      data: {
        label: item.label,
        componentType: item.type,
        props: {},
      },
    };

    const newNodes = [...nodes, newNode];
    setNodesState(newNodes);
    saveToHistory(newNodes, edges);
    toast.success(`已新增「${item.label}」元件`);
  }, [nodes, edges, screenToFlowPosition, saveToHistory]);

  const handleDragStart = useCallback((event: React.DragEvent, type: string) => {
    dragRef.current = type;
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const updateNodeProps = useCallback((key: string, value: string) => {
    if (!selectedNode) return;
    setNodesState((nds) => {
      const updated = nds.map((n) => n.id === selectedNode.id
        ? { ...n, data: { ...n.data, props: { ...n.data.props, [key]: value } } }
        : n
      ) as ScreenNode[];
      saveToHistory(updated, edges);
      setSelectedNode((prev) => prev?.id === selectedNode.id ? updated.find((n) => n.id === selectedNode.id) ?? null : prev);
      return updated;
    });
  }, [selectedNode, edges, saveToHistory]);

  const deleteNode = useCallback(() => {
    if (!selectedNode) return;
    const newNodes = nodes.filter((n) => n.id !== selectedNode.id);
    const newEdges = edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id);
    setNodesState(newNodes);
    setEdgesState(newEdges);
    saveToHistory(newNodes, newEdges);
    setSelectedNode(null);
    toast.success('已刪除元件');
  }, [selectedNode, nodes, edges, saveToHistory]);

  const save = () => {
    toast.success(`「${screenName}」已儲存（共 ${nodes.length} 個元件）`);
  };

  const preview = () => {
    toast('預覽功能開發中…', { icon: '🚧' });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-120px)] max-w-[1800px] flex-col px-4 pb-4">
      <CommonHeroTitle
        icon={LayoutGrid}
        title="畫面設計器"
        description="以拖拉方式進行表單與畫面的視覺化設計，快速建立前端頁面原型"
        breadcrumb={['工作流程管理', '畫面設計']}
        extraButtons={[
          { label: '儲存', icon: Save, onClick: save },
          { label: '預覽', icon: Eye, onClick: preview },
        ]}
      />

      <div className="flex flex-1 gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* ---- Left: Component Palette ---- */}
        <aside className="flex w-56 flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <input
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
              placeholder="搜尋元件..."
              readOnly
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {categories.map((cat) => {
              const items = componentPalette.filter((c) => c.category === cat.key);
              if (!items.length) return null;
              return (
                <div key={cat.key} className="mb-3">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{cat.label}</p>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.type)}
                        className="flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700 active:cursor-grabbing dark:text-gray-300 dark:hover:bg-primary-900/20"
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ---- Center: Canvas ---- */}
        <div className="relative flex-1">
          {/* Toolbar */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm dark:border-gray-600 dark:bg-gray-800">
            <input
              className="w-40 border-b border-transparent bg-transparent px-1 text-sm font-semibold focus:border-primary-500 focus:outline-none dark:text-white"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
            />
            <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <button onClick={undo} disabled={historyIndex <= 0} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" title="復原"><Undo2 className="h-4 w-4" /></button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700" title="重做"><Redo2 className="h-4 w-4" /></button>
            <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <button onClick={() => setShowProperties((v) => !v)} className={`rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${showProperties ? 'text-primary-600' : ''}`} title="屬性面板"><Settings2 className="h-4 w-4" /></button>
          </div>

          {/* Status bar */}
          <div className="absolute bottom-3 left-3 z-10 rounded bg-white/80 px-2 py-0.5 text-[10px] text-gray-400 shadow-sm dark:bg-gray-800/80">
            {nodes.length} 個元件 · {edges.length} 條連線
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            defaultEdgeOptions={{ animated: true, style: { strokeWidth: 2 } }}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls position="bottom-right" />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => {
                const type = (n as ScreenNode).data?.componentType;
                if (['textInput', 'textarea', 'select', 'checkbox', 'datepicker', 'fileupload', 'button', 'email', 'phone', 'number'].includes(type)) return '#3b82f6';
                if (['card', 'columns', 'separator'].includes(type)) return '#8b5cf6';
                if (['table', 'chart'].includes(type)) return '#10b981';
                return '#6b7280';
              }}
              style={{ height: 120, width: 180 }}
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <LayoutGrid className="mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm">從左側拖曳元件至此處開始設計</p>
              <p className="mt-1 text-xs text-gray-300">支援連線、分組、屬性設定與即時預覽</p>
            </div>
          )}
        </div>

        {/* ---- Right: Properties Panel ---- */}
        {showProperties && (
          <aside className="flex w-64 flex-col border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300">屬性設定</h3>
              {selectedNode && (
                <button onClick={deleteNode} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="刪除元件"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {selectedNode ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">元件類型</label>
                    <div className="flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-700">
                      <ChevronRight className="h-3 w-3 text-primary-600" />
                      <span className="font-medium text-gray-700 dark:text-gray-200">{selectedNode.data.label}</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">顯示名稱</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700"
                      value={selectedNode.data.label}
                      onChange={(e) => {
                        setNodesState((nds) => {
                          const updated = nds.map((n) => n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                          ) as ScreenNode[];
                          setSelectedNode((prev) => prev?.id === selectedNode.id ? updated.find((n) => n.id === selectedNode.id) ?? null : prev);
                          return updated;
                        });
                      }}
                    />
                  </div>
                  {selectedNode.data.componentType === 'button' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">按鈕文字</label>
                      <input className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700" value={selectedNode.data.props.label || ''} onChange={(e) => updateNodeProps('label', e.target.value)} />
                    </div>
                  )}
                  {['textInput', 'textarea', 'email', 'phone', 'number'].includes(selectedNode.data.componentType) && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">佔位文字</label>
                      <input className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700" value={selectedNode.data.props.placeholder || ''} onChange={(e) => updateNodeProps('placeholder', e.target.value)} />
                    </div>
                  )}
                  {['text', 'heading', 'paragraph'].includes(selectedNode.data.componentType) && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">內容文字</label>
                      <textarea className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700" rows={3} value={selectedNode.data.props.text || ''} onChange={(e) => updateNodeProps('text', e.target.value)} />
                    </div>
                  )}
                  {selectedNode.data.componentType === 'checkbox' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">勾選標籤</label>
                      <input className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700" value={selectedNode.data.props.label || ''} onChange={(e) => updateNodeProps('label', e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase text-gray-400">元件 ID</label>
                    <p className="rounded bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-500 dark:bg-gray-700">{selectedNode.id}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-gray-400">
                  <Settings2 className="mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-xs">點選元件以編輯屬性</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wrapped Export                                                     */
/* ------------------------------------------------------------------ */

export default function ScreenDesignerPage() {
  return (
    <ReactFlowProvider>
      <ScreenDesignerInner />
    </ReactFlowProvider>
  );
}
