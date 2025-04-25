addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Check if this is a preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': 'https://www.nihaalnazeer.com',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  // Forward the request to R2
  const url = new URL(request.url)
  const response = await fetch(`https://nihaalnazeer.com${url.pathname}`, {
    method: request.method,
    headers: request.headers
  })

  // Clone the response and add CORS headers
  const modifiedResponse = new Response(response.body, response)
  modifiedResponse.headers.set('Access-Control-Allow-Origin', 'https://www.nihaalnazeer.com')
  
  return modifiedResponse
} 