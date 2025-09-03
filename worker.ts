// Import and export the Hono app directly
import app, { AIChatWebSocket, VoiceAIWebSocket, UserSysDO } from './src/server/index';

export default app;
export { AIChatWebSocket, VoiceAIWebSocket, UserSysDO };
// Debug: Force reload to fix TTS base64 audio handling
