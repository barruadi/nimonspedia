const API_BASE = '/api';

async function request(path, {
  method='GET',
  body,
  headers={},
  credentials='include',
  signal
} = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch(API_BASE + path, {
    method,
    credentials,
    headers: {
      'Accept': 'application/json',
      ...(!isForm && body ? { 'Content-Type': 'application/json' } : {}),
      // Cookies
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    signal
  })
  
  const text = await res.text();
  const data = text ? (() => { 
    try { 
      return JSON.parse(text); 
    } catch { 
      return { raw: text }; 
    }})() : null;
  
  // res status checks
  if (!res.ok) {
    return null;
  }
  
  return data;
}

export const api = {
  get:  (p, o)    => request(p, {...o, method: 'GET'}),
  post: (p, b, o) => request(p, {...o, method: 'POST', body: b}),
  put:  (p, b, o) => request(p, {...o, method: 'PUT',  body: b}),
  del:  (p, o)    => request(p, {...o, method: 'DELETE'}),
}