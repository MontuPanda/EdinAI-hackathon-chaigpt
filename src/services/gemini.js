/**
 * PROTÉGÉ: Gemini API Gateway Client
 * Handles direct REST calls to Google AI Studio Gemini API with
 * dual-key failover and connection diagnostics.
 */

const STORAGE_KEYS = {
  PRIMARY: 'protege_gemini_primary_key',
  SECONDARY: 'protege_gemini_secondary_key',
  MODEL: 'protege_gemini_model',
  MOCK_MODE: 'protege_mock_mode'
};

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

class GeminiClient {
  constructor() {
    this.primaryKey = localStorage.getItem(STORAGE_KEYS.PRIMARY) || '';
    this.secondaryKey = localStorage.getItem(STORAGE_KEYS.SECONDARY) || '';
    
    // Auto-migrate legacy 1.5/2.0 to 3.8 Flash
    const storedModel = localStorage.getItem(STORAGE_KEYS.MODEL);
    if (!storedModel || storedModel.startsWith('gemini-1.') || storedModel.startsWith('gemini-2.0')) {
      this.model = 'gemini-3.8-flash';
      localStorage.setItem(STORAGE_KEYS.MODEL, this.model);
    } else {
      this.model = storedModel;
    }

    this.isMockMode = localStorage.getItem(STORAGE_KEYS.MOCK_MODE) === 'true';
  }

  setKeys({ primaryKey, secondaryKey, model, mockMode = false }) {
    this.primaryKey = (primaryKey || '').trim();
    this.secondaryKey = (secondaryKey || '').trim();
    this.model = model || 'gemini-3.8-flash';
    this.isMockMode = !!mockMode;

    localStorage.setItem(STORAGE_KEYS.PRIMARY, this.primaryKey);
    localStorage.setItem(STORAGE_KEYS.SECONDARY, this.secondaryKey);
    localStorage.setItem(STORAGE_KEYS.MODEL, this.model);
    localStorage.setItem(STORAGE_KEYS.MOCK_MODE, this.isMockMode ? 'true' : 'false');
  }

  hasValidKey() {
    return this.isMockMode || !!this.primaryKey;
  }

  /**
   * Tests the API key with a minimal request to measure roundtrip latency.
   * @param {string} testKey 
   * @param {string} testModel 
   * @returns {Promise<{success: boolean, latencyMs: number, message: string}>}
   */
  async testConnection(testKey = this.primaryKey, testModel = this.model) {
    if (!testKey) {
      return { success: false, latencyMs: 0, message: 'No API key provided.' };
    }

    const startTime = performance.now();
    const endpoint = `${BASE_URL}/${testModel}:generateContent?key=${testKey}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Respond with exactly two words: "221B_CONFIRMED".' }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0.1
          }
        })
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          latencyMs,
          message: errorMsg
        };
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      return {
        success: true,
        latencyMs,
        message: `Handshake successful (${reply || 'OK'}) via ${testModel}`
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        message: `Network error: ${err.message}`
      };
    }
  }

  /**
   * Universal call method to Gemini API with automatic dual-key failover.
   */
  async generateContent({
    systemInstruction = '',
    prompt = '',
    inlineData = null,
    temperature = 0.7,
    jsonMode = false,
    model = this.model
  } = {}) {
    if (this.isMockMode) {
      console.warn('[GeminiClient] Mock mode active; returning null to allow local simulation fallback.');
      return null;
    }

    const userParts = [];
    if (prompt) userParts.push({ text: prompt });
    if (inlineData) userParts.push({ inlineData });

    const payload = {
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: {
        temperature: temperature,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {})
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        role: 'system',
        parts: [{ text: systemInstruction }]
      };
    }

    // Try primary key first
    try {
      return await this._callWithKey(this.primaryKey, model, payload);
    } catch (primaryErr) {
      console.warn('[GeminiClient] Primary key failed:', primaryErr.message);

      // If we have a secondary key and hit rate limits or auth failure, fail over!
      if (this.secondaryKey && (primaryErr.status === 429 || primaryErr.status === 403)) {
        console.info('[GeminiClient] Failing over to secondary API key...');
        return await this._callWithKey(this.secondaryKey, model, payload);
      }

      throw primaryErr;
    }
  }

  async _callWithKey(key, model, payload) {
    if (!key) throw new Error('Gemini API key is not configured.');

    const endpoint = `${BASE_URL}/${model}:generateContent?key=${key}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData?.error?.message || `HTTP ${response.status} from Gemini API`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

export const gemini = new GeminiClient();
