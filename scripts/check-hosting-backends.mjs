import { pathToFileURL } from 'node:url';

const project = 'gen-lang-client-0036445484';
const region = 'asia-northeast1';

export async function checkHostingBackends(token, request = fetch) {
  if (!token) throw new Error('Google access token is required for backend verification.');
  // CLI resolves function rewrites through both generations' list endpoints.
  for (const version of ['v1', 'v2']) {
    const response = await request(`https://cloudfunctions.googleapis.com/${version}/projects/${project}/locations/-/functions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Cannot list ${version} function metadata (${response.status}).`);
    const payload = await response.json();
    if (payload.unreachable?.length) throw new Error(`${version} function metadata has unreachable regions.`);
  }
  for (const name of ['siteApi', 'raahApi']) {
    const response = await request(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${region}/functions/${name}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Cannot read ${name} metadata (${response.status}).`);
    const data = await response.json();
    if (data.environment !== 'GEN_2' || data.state !== 'ACTIVE' || !data.serviceConfig?.service) {
      throw new Error(`${name} must be an active second-generation function with a Cloud Run service.`);
    }
    // Deliberately do not log function configuration, environment variables or tokens.
  }
  return 'Both existing API backends are active and readable.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkHostingBackends(process.env.GOOGLE_ACCESS_TOKEN)
    .then(message => console.log(message))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
