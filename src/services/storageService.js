import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_HISTORY_KEY = '@ihc_tutor:chat_history_v1';
const CORRECTIONS_KEY = '@ihc_tutor:corrections_v1';

/**
 * Mensagem inicial do Tutor com foco nos 3 pilares de IHC:
 * 1. Explicabilidade (Fontes e Raciocínio)
 * 2. Confiança Calibrada (Nível de Confiança + Justificativa)
 * 3. Design de Erros e Controle do Usuário (Correção Human-in-the-Loop)
 */
export const INITIAL_WELCOME_MESSAGE = {
  id: 'welcome-msg-1',
  role: 'assistant',
  questionAsked: 'Como funciona este Tutor Inteligente de IHC?',
  answer:
    'Olá! Sou seu Tutor Acadêmico projetado com foco em Interface Humano-Computador (IHC) e Interação Humano-IA (HAI).\n\nPara toda pergunta que você fizer, eu apresento:\n1. Nível de Confiança Calibrada: Uma estimativa transparente de certeza e o motivo dela, evitando confiança cega (overtrust).\n2. Explicabilidade (XAI): As fontes bibliográficas consultadas, os passos do meu raciocínio e as limitações da resposta.\n3. Design de Erros e Controle Humano: Caso você identifique qualquer imprecisão ou queira ensinar uma resposta melhor para uma questão, basta tocar em "Corrigir Resposta". Sua correção fica salva localmente e passa a ser minha fonte prioritária.',
  confidenceScore: 96,
  confidenceLevel: 'alta',
  confidenceJustification:
    'As funcionalidades descritas fazem parte da especificação arquitetural direta deste sistema tutor baseado nas diretrizes de IHC.',
  reasoningSteps: [
    'Identificação do papel pedagógico do chatbot na disciplina de IHC.',
    'Exposição transparente dos mecanismos de Explicabilidade (XAI) e Confiança Calibrada.',
    'Instrução clara sobre como o aluno pode recuperar e corrigir erros do modelo (Human-in-the-Loop).',
  ],
  limitations:
    'Respostas geradas por modelos de linguagem podem conter imprecisões factuais (alucinações). Sempre confira as fontes exibidas e utilize o botão de correção quando necessário.',
  sources: [
    {
      title: 'Guidelines for Human-AI Interaction (G1, G2, G9, G11)',
      authorOrOrigin: 'Amershi et al. (Microsoft Research, CHI 2019)',
      type: 'Artigo Científico',
      snippet:
        'G1: Make clear what the system can do. G2: Make clear how well the system can do what it can do. G9: Support efficient correction. G11: Make clear why the system did what it did.',
    },
    {
      title: '10 Usability Heuristics for User Interface Design',
      authorOrOrigin: 'Jakob Nielsen (Nielsen Norman Group)',
      type: 'Referência Clássica de IHC',
      snippet:
        'Visibilidade do status do sistema, controle e liberdade do usuário, prevenção de erros e auxílio para reconhecer, diagnosticar e recuperar-se de erros.',
    },
  ],
  originMode: 'system',
  timestamp: new Date().toISOString(),
  isCorrected: false,
  correctionData: null,
};

/**
 * Carrega o histórico de mensagens salvo localmente.
 */
export async function loadChatHistory() {
  try {
    const raw = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) {
      return [INITIAL_WELCOME_MESSAGE];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_WELCOME_MESSAGE];
  } catch (error) {
    console.warn('Falha ao carregar histórico local:', error);
    return [INITIAL_WELCOME_MESSAGE];
  }
}

/**
 * Salva o histórico de mensagens localmente.
 */
export async function saveChatHistory(messages) {
  try {
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    return true;
  } catch (error) {
    console.warn('Falha ao salvar histórico local:', error);
    return false;
  }
}

/**
 * Carrega a lista de correções feitas pelo aluno.
 */
export async function loadCorrections() {
  try {
    const raw = await AsyncStorage.getItem(CORRECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Falha ao carregar correções locais:', error);
    return [];
  }
}

/**
 * Salva ou atualiza uma correção do aluno na persistência leve.
 */
export async function saveCorrectionEntry(entry) {
  try {
    const existing = await loadCorrections();
    const filtered = existing.filter(
      (item) =>
        item.id !== entry.id &&
        normalizeQuestion(item.question) !== normalizeQuestion(entry.question)
    );
    const updated = [entry, ...filtered];
    await AsyncStorage.setItem(CORRECTIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Falha ao salvar correção:', error);
    throw error;
  }
}

/**
 * Remove uma correção específica pelo ID.
 */
export async function removeCorrectionEntry(correctionId) {
  try {
    const existing = await loadCorrections();
    const updated = existing.filter((item) => item.id !== correctionId);
    await AsyncStorage.setItem(CORRECTIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Falha ao remover correção:', error);
    throw error;
  }
}

/**
 * Limpa apenas o histórico do chat (mantendo as correções aprendidas).
 */
export async function resetChatHistoryOnly() {
  const initial = [
    {
      ...INITIAL_WELCOME_MESSAGE,
      timestamp: new Date().toISOString(),
    },
  ];
  await saveChatHistory(initial);
  return initial;
}

/**
 * Limpa todos os dados locais (histórico e correções).
 */
export async function clearAllPersistedData() {
  await AsyncStorage.multiRemove([CHAT_HISTORY_KEY, CORRECTIONS_KEY]);
  return {
    messages: [{ ...INITIAL_WELCOME_MESSAGE, timestamp: new Date().toISOString() }],
    corrections: [],
  };
}

/**
 * Normaliza texto de pergunta para comparação de memória de correções.
 */
export function normalizeQuestion(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca se já existe uma correção salva pelo aluno para uma questão igual ou muito similar.
 */
export function findMatchingCorrection(question, corrections = []) {
  const normQ = normalizeQuestion(question);
  if (!normQ || normQ.length < 4) return null;

  for (const corr of corrections) {
    const normCorrQ = normalizeQuestion(corr.question);
    if (!normCorrQ) continue;
    if (normQ === normCorrQ) {
      return corr;
    }
    const qWords = normQ.split(' ').filter((w) => w.length > 3);
    const cWords = normCorrQ.split(' ').filter((w) => w.length > 3);
    if (qWords.length >= 2 && cWords.length >= 2) {
      const common = qWords.filter((w) => cWords.includes(w));
      const similarity = common.length / Math.max(qWords.length, cWords.length);
      if (similarity >= 0.75) {
        return corr;
      }
    }
  }
  return null;
}
