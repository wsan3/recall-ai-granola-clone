// Neither of these is a secret - the Recall API key stays server-side in the
// backend. This just tells the desktop app where to find its own backend and
// which Recall region that backend's workspace belongs to.
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";
export const RECALL_API_URL = process.env.RECALL_API_URL ?? "https://us-west-2.recall.ai";
