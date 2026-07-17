import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Download,
  RefreshCw,
  Settings,
  X,
  Send,
  ChevronDown,
  LayoutDashboard,
  FileJson,
  FileText,
  Image,
  Printer,
  MoreVertical,
  Maximize2,
  Minimize2,
  ExternalLink
} from 'lucide-react';
import Breadcrumb from './Breadcrumb';
import './CommonHeroTitle.css';

const CommonHeroTitle = ({
  icon: IconComponent = LayoutDashboard,
  title,
  version,
  description,
  breadcrumb,
  context,
  tags = [],
  onAiPrompt,
  onExport,
  onRefresh,
  onSettings,
  onFullscreenChange,
  extraButtons = [],
  theme = {}
}) => {
  const [isCompact, setIsCompact] = useState(false);
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const exportDropdownRef = useRef(null);
  const moreDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setShowExportDropdown(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target)) {
        setShowMoreDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleFullscreen = useCallback(() => {
    const entering = !document.fullscreenElement;
    if (entering) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
    if (onFullscreenChange) {
      onFullscreenChange(entering);
    }
  }, [onFullscreenChange]);

  const handleAiPromptSubmit = async () => {
    if (!aiPromptText.trim()) return;

    setIsProcessing(true);
    try {
      if (onAiPrompt) {
        await onAiPrompt(aiPromptText);
      }
      setAiPromptText('');
      setShowAiPromptModal(false);
    } catch (error) {
      console.error('AI Prompt 處理失敗:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportClick = (format) => {
    if (onExport) {
      onExport(format);
    }
    setShowExportDropdown(false);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings();
    }
  };

  const toggleCompact = () => {
    setIsCompact(!isCompact);
  };

  const heroStyle = {
    background: theme.background
      ? theme.background
      : theme.gradient
        ? `linear-gradient(${theme.gradient.angle || 135}deg, ${(theme.gradient.stops || []).map(s => `${s.color} ${s.position}`).join(', ')})`
        : undefined,
    borderColor: theme.borderColor || undefined
  };
  const iconBtnStyle = {
    background: theme.iconBtnBg || undefined,
    color: theme.iconBtnColor || undefined,
    borderColor: theme.iconBtnBorder || undefined
  };
  const titleStyle = {
    color: theme.titleColor || undefined
  };
  const descStyle = {
    color: theme.descColor || undefined
  };
  const versionStyle = {
    background: theme.versionBg || undefined,
    color: theme.versionColor || undefined
  };

  return (
    <>
      <section
        className={`common-hero ${isCompact ? 'compact' : ''}`}
        style={heroStyle}
      >
        <div className="common-hero-left">
          <button
            className="common-hero-icon-btn"
            style={iconBtnStyle}
            onClick={toggleCompact}
            title={isCompact ? "展開 Hero" : "收合 Hero"}
          >
            <IconComponent size={isCompact ? 18 : 42} />
          </button>

          <div className="common-hero-info">
            {breadcrumb && !isCompact && (
              <Breadcrumb
                items={
                  Array.isArray(breadcrumb)
                    ? breadcrumb
                    : breadcrumb.split(' > ').map((s) => s.trim())
                }
              />
            )}
            <div className="common-hero-title-row">
              <h1 className="common-hero-title" style={titleStyle}>{title}</h1>
              {version && <span className="common-hero-version" style={versionStyle}>v{version}</span>}
            </div>
            {description && !isCompact && (
              <p className="common-hero-description" style={descStyle}>{description}</p>
            )}
            {tags.length > 0 && !isCompact && (
              <div className="common-hero-tags">
                {tags.map((tag, idx) => {
                  const isExternal = !!tag.href;
                  if (isExternal) {
                    return (
                      <a
                        key={idx}
                        className="common-hero-tag"
                        href={tag.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tag.tooltip || tag.label}
                      >
                        <span>{tag.label}</span>
                        <ExternalLink size={11} />
                      </a>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      className={`common-hero-tag${tag.active ? ' active' : ''}`}
                      onClick={tag.onClick}
                      title={tag.tooltip || tag.label}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="common-hero-right">
          <div className="common-hero-actions">
            <div className="common-hero-actions-row">
              <button
                style={{ display: "none" }}
                className="common-hero-btn common-hero-btn-ai"
                onClick={() => setShowAiPromptModal(true)}
                title="AI Prompt - 使用 AI 調整儀表板"
              >
                <Sparkles size={16} />
                <span>AI Prompt</span>
              </button>

              <div className="common-hero-dropdown" ref={exportDropdownRef}>
                <button
                  style={{ display: "none" }}
                  className="common-hero-btn common-hero-btn-export"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  title="匯出"
                >
                  <Download size={16} />
                  <span>Export</span>
                  <ChevronDown size={14} />
                </button>
                {showExportDropdown && (
                  <div className="common-hero-dropdown-menu">
                    <button onClick={() => handleExportClick('json')}>
                      <FileJson size={16} />
                      <span>JSON</span>
                    </button>
                    <button onClick={() => handleExportClick('csv')}>
                      <FileText size={16} />
                      <span>CSV</span>
                    </button>
                    <button onClick={() => handleExportClick('png')}>
                      <Image size={16} />
                      <span>PNG</span>
                    </button>
                    <button onClick={() => handleExportClick('print')}>
                      <Printer size={16} />
                      <span>列印</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                className="common-hero-btn common-hero-btn-refresh"
                onClick={handleRefresh}
                title="重新整理"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>

              <button
                style={{ display: "none" }}
                className="common-hero-btn common-hero-btn-settings"
                onClick={handleSettings}
                title="設定"
              >
                <Settings size={16} />
              </button>

              <button
                className="common-hero-btn common-hero-btn-fullscreen"
                onClick={handleFullscreen}
                title={isFullscreen ? "退出全螢幕" : "全螢幕"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>

            <div className="common-hero-divider"></div>

            <div className="common-hero-actions-row">
              {extraButtons.map((btn, idx) => (
                <button
                  key={idx}
                  className="common-hero-btn common-hero-btn-extra"
                  onClick={btn.onClick}
                  title={btn.label}
                >
                  {btn.icon && <btn.icon size={16} />}
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {context && !isCompact && (
          <div className="common-hero-context-card">
            <b>{context.project}</b>
            <span>{context.region}</span>
            <small>{context.unit}</small>
          </div>
        )}
      </section >

      {showAiPromptModal && (
        <div
          className="ai-prompt-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAiPromptModal(false);
            }
          }}
        >
          <div className="ai-prompt-modal nordic-style">
            <div className="ai-prompt-header">
              <div className="ai-prompt-title-section">
                <Sparkles size={24} color="#8b5cf6" />
                <h3>AI Prompt</h3>
              </div>
              <button
                className="ai-prompt-close-btn"
                onClick={() => setShowAiPromptModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ai-prompt-content">
              <p className="ai-prompt-description">
                輸入您的需求，AI 將協助您調整儀表板的佈局與元素設定。
              </p>

              <div className="ai-prompt-input-section">
                <textarea
                  className="ai-prompt-textarea"
                  placeholder="例如：將訓練 Loss 趨勢圖移到左上角，並新增一個顯示 GPU 使用率的卡片..."
                  value={aiPromptText}
                  onChange={(e) => setAiPromptText(e.target.value)}
                  rows={4}
                  disabled={isProcessing}
                />

                <div className="ai-prompt-examples">
                  <p>範例需求：</p>
                  <ul>
                    <li>新增一個顯示「模型準確率」的 KPI 卡片</li>
                    <li>將「最近訓練任務」表格移到下方</li>
                    <li>調整所有卡片的背景色為淺灰色</li>
                  </ul>
                </div>
              </div>

              <div className="ai-prompt-info">
                <p>
                  <strong>注意：</strong>AI 將會建立新的佈局版本，並保留原有版本紀錄。
                </p>
              </div>
            </div>

            <div className="ai-prompt-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAiPromptModal(false)}
                disabled={isProcessing}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAiPromptSubmit}
                disabled={!aiPromptText.trim() || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    <span>處理中...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>送出</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )
      }
    </>
  );
};

export default CommonHeroTitle;
