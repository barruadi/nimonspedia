import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost/api/node';

export const useAuctions = (status = 'active', page = 1, search = '', limit = 10) => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0
  });

  const fetchAuctions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        status: status || 'active',
        page: page || 1,
        limit: limit || 10,
        ...(search && { q: search })
      });

      console.log('[useAuctions] Fetching with params:', {
        status: status || 'active',
        page: page || 1,
        limit: limit || 10,
        search: search || '(none)'
      });

      const response = await fetch(`${API_BASE_URL}/auctions?${params}`);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      console.log('[useAuctions] Response:', {
        ok: data.ok,
        dataCount: data.data?.length || 0,
        meta: data.meta
      });

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch auctions');
      }

      setAuctions(data.data || []);
      setPagination({
        page: data.meta.page,
        limit: data.meta.limit,
        totalCount: data.meta.totalCount,
        totalPages: data.meta.totalPages
      });

    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError(err.message || 'Failed to fetch auctions');
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [status, page, search, limit]);

  // Fetch when dependencies change
  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  return {
    auctions,
    loading,
    error,
    pagination,
    refetch: fetchAuctions
  };
};
