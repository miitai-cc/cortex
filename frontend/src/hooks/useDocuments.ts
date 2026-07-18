import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { DocumentIndexEvent } from '../grpc/documentWsClient';

export function useDocuments(params?: any) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => documentApi.list(params),
    refetchInterval: (query) => {
      const documents = query.state.data?.data?.data ?? [];
      return documents.some((document: { status: string }) =>
        document.status === 'pending' || document.status === 'processing'
      ) ? 1000 : false;
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => documentApi.get(id),
    enabled: !!id,
  });
}

export function useUploadDocument(
  onEvent: (file: File, event: DocumentIndexEvent) => void,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (file: File) => documentApi.upload(file, (event) => onEvent(file, event)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(t('common.success'));
    },
    onError: () => {
      toast.error(t('common.error'));
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success(t('common.success'));
    },
    onError: () => {
      toast.error(t('common.error'));
    },
  });
}
