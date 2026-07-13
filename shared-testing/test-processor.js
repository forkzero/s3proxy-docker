// Test processor for Artillery
export function setupScenario(_requestParams, _context, _ee, next) {
  // Add any setup logic here
  return next()
}

export function logResponse(requestParams, response, _context, _ee, next) {
  if (response.statusCode >= 400) {
    console.log(`Response: ${response.statusCode} for ${requestParams.url}`)
  }
  return next()
}
