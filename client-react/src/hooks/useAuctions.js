import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost/api/node';

export const useAuctions = (status = 'active', cursor = null, search = '', limit = 10) => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 10,
    hasNextPage: false,
    nextCursor: null
  });

  const fetchAuctions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        status: status || 'active',
        limit: limit || 10,
        ...(search && { q: search }),
        ...(cursor && { cursor })
      });

      console.log('[useAuctions] Fetching with cursor-based params:', {
        status: status || 'active',
        cursor: cursor || '(none)',
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
        limit: data.meta.limit,
        hasNextPage: data.meta.hasNextPage,
        nextCursor: data.meta.nextCursor
      });

    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError(err.message || 'Failed to fetch auctions');
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [status, cursor, search, limit]);

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
