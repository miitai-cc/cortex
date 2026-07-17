import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { Upload, Search as SearchIcon, Trash2, FileText } from 'lucide-react';
import { useDocuments, useUploadDocument, useDeleteDocument } from '../hooks/useDocuments';
import { Link } from 'react-router-dom';
import CommonHeroTitle from '../components/common/CommonHeroTitle';

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useDocuments({ search });
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.forEach((f) => uploadMutation.mutate(f)),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
  });

  return (
    <div>
      <CommonHeroTitle icon={FileText} title={t('documents.title')} />

      <div
        {...getRootProps()}
        className={`mb-6 p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-gray-600">{isDragActive ? t('documents.dropzone.active') : t('documents.upload')}</p>
        <p className="text-sm text-gray-400 mt-1">PDF, DOCX, TXT, MD</p>
      </div>

      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          className="input-field pl-10"
          placeholder={t('documents.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : (
        <div className="grid gap-4">
          {data?.data?.map((doc: any) => (
            <div key={doc.id} className="card flex items-center justify-between">
              <Link to={`/documents/${doc.id}`} className="flex-1">
                <p className="font-medium text-gray-900">{doc.filename}</p>
                <p className="text-sm text-gray-500">
                  {t(`documents.status.${doc.status}`)} · {doc.file_type}
                </p>
              </Link>
              <button
                onClick={() => deleteMutation.mutate(doc.id)}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
