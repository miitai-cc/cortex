import type { CSSProperties, ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

export interface CommonHeroBreadcrumbItem {
  label?: string;
  text?: string;
  href?: string;
}

export interface CommonHeroTag {
  label: string;
  href?: string;
  tooltip?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface CommonHeroContext {
  project?: string;
  region?: string;
  unit?: string;
}

export interface CommonHeroExtraButton {
  label: string;
  icon?: ComponentType<LucideProps>;
  onClick?: () => void;
}

export interface CommonHeroTheme {
  background?: CSSProperties['background'];
  gradient?: {
    angle?: number;
    stops?: Array<{ color: string; position: string }>;
  };
  borderColor?: CSSProperties['borderColor'];
  iconBtnBg?: CSSProperties['background'];
  iconBtnColor?: CSSProperties['color'];
  iconBtnBorder?: CSSProperties['borderColor'];
  titleColor?: CSSProperties['color'];
  descColor?: CSSProperties['color'];
  versionBg?: CSSProperties['background'];
  versionColor?: CSSProperties['color'];
}

export interface CommonHeroTitleProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  version?: string | number;
  description?: string;
  breadcrumb?: string | Array<string | CommonHeroBreadcrumbItem>;
  context?: CommonHeroContext;
  tags?: CommonHeroTag[];
  onAiPrompt?: (prompt: string) => void | Promise<void>;
  onExport?: (format: 'json' | 'csv' | 'png' | 'print') => void;
  onRefresh?: () => void;
  onSettings?: () => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
  extraButtons?: CommonHeroExtraButton[];
  theme?: CommonHeroTheme;
}

declare const CommonHeroTitle: ComponentType<CommonHeroTitleProps>;

export default CommonHeroTitle;
