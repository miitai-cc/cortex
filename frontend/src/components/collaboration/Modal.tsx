import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}

export default function Modal({ title, children, onClose, width = 'max-w-2xl' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92vh] w-full ${width} overflow-auto rounded-xl bg-white shadow-2xl dark:bg-gray-800`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
