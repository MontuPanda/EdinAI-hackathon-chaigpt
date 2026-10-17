/**
 * PROTÉGÉ: Watson live chat.
 * Watson only knows (a) his own current document and (b) what Holmes has
 * corrected/said so far. He must NOT see the source notes.
 */
import { gemini } from './gemini.js';

function formatHistory(history, limit = 8) {
  return history
    .slice(-limit)
    .map(m => `${m.sender === 'holmes' ? 'MENTOR' : 'YOU'}: ${m.text}`)
    .join('\n');
}

export async function watsonReply({ doc, paragraphIndex, history, message }) {
  const paragraph = doc.paragraphs[paragraphIndex];
  const allCorrections = doc.paragraphs.flatMap(p => p.corrections || []);

  const systemInstruction = `You are Dr. John Watson, an earnest, intelligent university student being taught by your mentor (Holmes) on the topic "${doc.title}".
You have NOT mastered this topic. You only know what is in your own document below plus what your mentor has told you.
Never claim knowledge beyond that. If the mentor states something, accept it provisionally, restate it in your own words, and ask ONE sharp follow-up that tests the boundary of the idea (an edge case, an example, or "why").
If the mentor's point is vague or just an assertion, politely ask for the mechanism.
Register: modern, technical, concise (2-3 sentences). No Victorian slang ("By Jove", etc.).`;

  const prompt = `YOUR CURRENT PARAGRAPH (topic: ${paragraph?.topic || 'general'}):
${paragraph?.content || '(none)'}

CORRECTIONS YOUR MENTOR HAS GIVEN SO FAR:
${allCorrections.length
    ? allCorrections.map(c => `- On "${c.selectedText}": ${c.userCorrection}`).join('\n')
    : '(none yet)'}

CONVERSATION SO FAR:
${formatHistory(history)}

MENTOR JUST SAID: "${message}"

Reply as Watson.`;

  try {
    const reply = await gemini.generateContent({ systemInstruction, prompt, temperature: 0.6 });
    if (reply && reply.trim()) return reply.trim();
  } catch (err) {
    console.warn('[watsonChat] live reply failed, using offline fallback:', err.message);
  }
  return offlineWatsonReply({ allCorrections, message, paragraph });
}

/** Offline fallback: varied, and grounded in the actual conversation (never one canned line). */
function offlineWatsonReply({ allCorrections, message, paragraph }) {
  const last = allCorrections[allCorrections.length - 1];
  const snippet = message.length > 90 ? message.slice(0, 87) + '...' : message;
  const options = [
    `So you're saying "${snippet}". Can you give me a concrete example so I can check I've understood it?`,
    last
      ? `Let me connect that to your earlier correction ("${last.userCorrection.slice(0, 80)}"). Does that mean my paragraph on ${paragraph?.topic || 'this topic'} needs rewording, or only that one sentence?`
      : `I'm not sure I follow yet. What would break if I kept my original assumption about ${paragraph?.topic || 'this topic'}?`,
    `That's helpful. What's the boundary case where that rule stops applying?`
  ];
  return options[Math.floor(Math.random() * options.length)];
}
