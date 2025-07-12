
// Test processor for Artillery
export function setupScenario(requestParams, context, ee, next) {
  // Add any setup logic here
  return next()
}

export function logResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.log(`Response: ${response.statusCode} for ${requestParams.url}`)
  }
  return next()
}
