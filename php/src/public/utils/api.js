const API_BASE = '/api';

function request(path, {
  method = 'GET',
  body,
  headers = {},
  withCredentials = true,
  signal,
} = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    let url = API_BASE + path;

    const isFormData =
      (typeof FormData !== 'undefined') && (body instanceof FormData);

    const isJSONBody =
      body &&
      !isFormData &&
      method !== 'GET' &&
      method !== 'DELETE';

    if ((method === 'GET' || method === 'DELETE') && body && !isFormData) {
      const qs = new URLSearchParams(body).toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    xhr.open(method, url, true);

    // include session cookie
    xhr.withCredentials = !!withCredentials;

    // Abort support
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.setRequestHeader('Accept', 'application/json');

    // Custom headers
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }

    if (isJSONBody && !headers['Content-Type']) {
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      // Network or aborted
      if (xhr.status === 0) {
        reject(new Error('Network error or aborted'));
        return;
      }

      const ok = xhr.status >= 200 && xhr.status < 300;

      const raw = xhr.responseText || '';
      let data = null;
      if (raw !== '') {
        try {
          data = JSON.parse(raw);
        } catch {
          data = { raw };
        }
      }

      if (!ok) {
        resolve(null);
        return;
      }

      resolve(data);
    };

    if (method === 'GET' || method === 'DELETE') {
      xhr.send();
    } else if (isFormData) {
      xhr.send(body);
    } else if (isJSONBody) {
      xhr.send(JSON.stringify(body));
    } else {
      xhr.send(null);
    }
  });
}

export const api = {
  get:  (p, o = {})    => request(p, { ...o, method: 'GET' }),
  post: (p, b, o = {}) => request(p, { ...o, method: 'POST',   body: b }),
  put:  (p, b, o = {}) => request(p, { ...o, method: 'PUT',    body: b }),
  del:  (p, o = {})    => request(p, { ...o, method: 'DELETE' }),
};
