/**
 * API Service for React App
 * Handles HTTP requests to PHP backend
 */

const API_BASE_URL = '/api';

/**
 * Fetch current session data from PHP backend
 * @returns {Promise<Object>} Session data with user info and session ID
 */
export async function fetchSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/session`, {
      method: 'GET',
      credentials: 'include', // Include cookies for session
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching session:', error);
    throw error;
  }
}

/**
 * Get user data from /api/me endpoint
 * @returns {Promise<Object>} User data
 */
export async function fetchUserData() {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

export default {
  fetchSession,
  fetchUserData,
};
