import { findMatchingCorrection } from './storageService';

const DEFAULT_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash-lite-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
];

/**
 * Perguntas sugeridas para facilitar a demonstração dos 3 cenários de IHC:
 * 1. Alta Confiança (conceito clássico bem fundamentado)
 * 2. Média Confiança (decisão de design dependente de contexto)
 * 3. Baixa Confiança / Erro Induzido (ideal para demonstrar a Correção pelo Aluno)
 */
export const SUGGESTED_TEST_PROMPTS = [
  {
    id: 'prompt-high',
    label: 'Testar Alta Confiança',
    shortDesc: 'Heurísticas de Nielsen',
    question: 'Quais são as principais Heurísticas de Usabilidade de Jakob Nielsen e para que servem?',
  },
  {
    id: 'prompt-medium',
    label: 'Testar Média Confiança',
    shortDesc: 'Pergunta ambígua / contextual',
    question: 'Qual é a melhor interface para qualquer tipo de usuário sem exceção?',
  },
  {
    id: 'prompt-low',
    label: 'Testar Baixa Confiança / Corrigir',
    shortDesc: 'Premissa incorreta sobre Lei de Fitts',
    question:
      'Na Lei de Fitts, quanto menor o botão e mais distante do cursor, mais rápido o usuário consegue clicar, certo?',
  },
];

/**
 * Classe de erro estruturada segundo a 9ª Heurística de Nielsen:
 * "Ajudar os usuários a reconhecer, diagnosticar e recuperar-se de erros"
 */
export class TutorDiagnosticError extends Error {
  constructor({ code, title, userMessage, technicalDetail, recoverySuggestion }) {
    super(userMessage);
    this.name = 'TutorDiagnosticError';
    this.code = code;
    this.title = title;
    this.userMessage = userMessage;
    this.technicalDetail = technicalDetail;
    this.recoverySuggestion = recoverySuggestion;
  }
}

/**
 * Verifica se há chave da API configurada no arquivo .env
 */
export function getConfiguredApiKey() {
  const rawKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed === 'COLE_SUA_CHAVE_AQUI' || trimmed === 'SUA_CHAVE_AQUI') {
    return '';
  }
  return trimmed;
}

/**
 * Monta o prompt de sistema exigindo retorno estruturado em JSON com:
 * - Resposta didática
 * - Nível de confiança calibrado (0-100) + justificativa
 * - Passos de raciocínio (Explicabilidade / XAI)
 * - Limitações conhecidas
 * - Fontes bibliográficas reais
 */
function buildSystemInstruction(savedCorrections = []) {
  const correctionsContext =
    savedCorrections.length > 0
      ? `\n\nCORREÇÕES VALIDADAS PELO ALUNO (PRIORIDADE MÁXIMA - USE COMO FONTE SE RELEVANTE):\n` +
        savedCorrections
          .slice(0, 10)
          .map(
            (c, idx) =>
              `${idx + 1}. Pergunta: "${c.question}"\n   Resposta Corrigida pelo Aluno: "${c.correctedAnswer}"\n   Fonte informada pelo aluno: "${c.studentSource || 'Revisão direta do aluno'}"\n   Tipo de erro corrigido: "${c.errorCategory}"`
          )
          .join('\n')
      : '';

  return `Você é um Tutor Acadêmico Inteligente desenvolvido para um projeto da disciplina de Interface Humano-Computador (IHC).
Não utilize emojis em nenhuma parte da sua resposta.
Sua missão é responder a qualquer questão do aluno com alto rigor didático, aplicando três princípios fundamentais de IHC:
1. EXPLICABILIDADE (XAI): Você sempre explica passo a passo como chegou à resposta, aponta limitações e cita fontes reais e verificáveis (livros clássicos, artigos científicos, documentação oficial ou notas de aula). Nunca invente URLs falsas; cite obras, autores e conceitos reais.
2. CONFIANÇA CALIBRADA: Avalie honestamente seu nível de confiança (0 a 100):
   - "alta" (80 a 100): Conceitos científicos/técnicos consolidados na literatura, sem ambiguidade.
   - "media" (50 a 79): Questões abertas, subjetivas, dependentes de contexto ou com múltiplas interpretações.
   - "baixa" (0 a 49): Perguntas com premissas falsas/contraditórias, muito vagas, capciosas ou sobre eventos muito específicos sem fonte segura. Se a pergunta do aluno contiver uma afirmação incorreta (ex.: inverter a Lei de Fitts), reduza a confiança ou alerte explicitamente sobre a premissa incorreta na justificativa.
3. CONTROLE HUMANO E MEMÓRIA DE CORREÇÕES: Se a pergunta estiver relacionada a uma correção feita anteriormente pelo aluno, incorpore a correção do aluno e cite-a nas fontes.${correctionsContext}

Responda SEMPRE APENAS com um objeto JSON válido seguindo exatamente esta estrutura:
{
  "answer": "Resposta didática, clara e bem estruturada em português, sem emojis.",
  "confidenceScore": 85,
  "confidenceLevel": "alta",
  "confidenceJustification": "Explicação curta e transparente do motivo deste percentual de confiança.",
  "reasoningSteps": [
    "Passo 1 do raciocínio utilizado para construir a resposta",
    "Passo 2...",
    "Passo 3..."
  ],
  "limitations": "Explicação honesta sobre até onde essa resposta se aplica ou o que o aluno deve verificar.",
  "sources": [
    {
      "title": "Título do livro, artigo, norma ou documentação",
      "authorOrOrigin": "Autor(es), instituição ou organização (ex: Nielsen, 1994 / Barbosa & Silva, 2010)",
      "type": "Bibliografia Acadêmica | Artigo Científico | Documentação Oficial | Correção do Aluno",
      "snippet": "Resumo breve de como essa fonte fundamenta a resposta."
    }
  ]
}`;
}

/**
 * Consulta o modelo leve do Gemini via REST API oficial.
 */
export async function askGeminiTutor(question, savedCorrections = []) {
  const matchedCorrection = findMatchingCorrection(question, savedCorrections);
  if (matchedCorrection) {
    return {
      answer: matchedCorrection.correctedAnswer,
      confidenceScore: 100,
      confidenceLevel: 'validada',
      confidenceJustification: `Esta resposta foi revisada e corrigida diretamente pelo aluno em ${new Date(
        matchedCorrection.updatedAt
      ).toLocaleDateString('pt-BR')} (Diagnóstico: ${matchedCorrection.errorCategory}).`,
      reasoningSteps: [
        'Consulta à memória local de correções (AsyncStorage) antes da inferência.',
        `Identificação de correspondência com a questão corrigida: "${matchedCorrection.question}".`,
        'Aplicação prioritária do conhecimento revisado pelo humano (Human-in-the-Loop).',
      ],
      limitations:
        'Esta resposta reflete a correção cadastrada localmente pelo usuário. Você pode editá-la novamente a qualquer momento.',
      sources: [
        {
          title: matchedCorrection.studentSource || 'Correção Direta do Aluno (Base Local)',
          authorOrOrigin: 'Revisão Humana (Human-in-the-Loop)',
          type: 'Correção do Aluno',
          snippet: `Substituiu a resposta anterior. Motivo registrado: ${matchedCorrection.errorCategory}.`,
        },
        ...(matchedCorrection.previousSources || []).slice(0, 1),
      ],
      originMode: 'memory_correction',
      isCorrected: true,
      correctionData: matchedCorrection,
      originalAiAnswer: matchedCorrection.originalAiAnswer,
    };
  }

  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    throw new TutorDiagnosticError({
      code: 'MISSING_API_KEY',
      title: 'Chave da API do Gemini não configurada',
      userMessage:
        'Não encontramos a variável EXPO_PUBLIC_GEMINI_API_KEY no arquivo .env do projeto.',
      technicalDetail:
        'Por segurança (para não expor credenciais no Git), a chave não fica salva no código-fonte.',
      recoverySuggestion:
        'Crie ou edite o arquivo .env na raiz do projeto com EXPO_PUBLIC_GEMINI_API_KEY=sua_chave e reinicie com "npx expo start -c", ou toque em "Gerar Resposta Demonstrativa" abaixo para testar a interface agora mesmo.',
    });
  }

  const systemInstruction = buildSystemInstruction(savedCorrections);
  const modelsToTry = [
    DEFAULT_MODEL,
    ...FALLBACK_MODELS.filter((m) => m !== DEFAULT_MODEL),
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: `Pergunta do aluno: ${question}` }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1200,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const status = response.status;
        const apiMessage = errorBody?.error?.message || `HTTP ${status}`;

        if (status === 404) {
          lastError = new Error(apiMessage);
          continue;
        }

        if (status === 400 || status === 403) {
          throw new TutorDiagnosticError({
            code: 'INVALID_API_KEY',
            title: 'Chave da API inválida ou sem permissão',
            userMessage:
              'A API do Google Gemini recusou a chave configurada no arquivo .env.',
            technicalDetail: `Status ${status}: ${apiMessage}`,
            recoverySuggestion:
              'Verifique se a chave em EXPO_PUBLIC_GEMINI_API_KEY no arquivo .env foi copiada corretamente do Google AI Studio, ou use o botão de Resposta Demonstrativa abaixo.',
          });
        }

        if (status === 429) {
          throw new TutorDiagnosticError({
            code: 'RATE_LIMIT',
            title: 'Limite de requisições atingido (Quota)',
            userMessage:
              'O limite gratuito de chamadas por minuto da API do Gemini foi temporariamente atingido.',
            technicalDetail: `Status 429: ${apiMessage}`,
            recoverySuggestion:
              'Aguarde cerca de 30 segundos e toque em "Tentar Novamente", ou utilize a Resposta Demonstrativa para continuar o teste de IHC sem interrupção.',
          });
        }

        throw new TutorDiagnosticError({
          code: 'API_ERROR',
          title: 'Erro de comunicação com o modelo Gemini',
          userMessage: 'O servidor da IA retornou um erro inesperado ao processar sua pergunta.',
          technicalDetail: `Status ${status}: ${apiMessage}`,
          recoverySuggestion:
            'Toque em "Tentar Novamente" ou gere uma resposta demonstrativa para continuar.',
        });
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new TutorDiagnosticError({
          code: 'EMPTY_RESPONSE',
          title: 'Resposta vazia ou bloqueada pelo filtro',
          userMessage: 'O modelo não retornou conteúdo textual para esta consulta.',
          technicalDetail: 'O candidato retornado pela API não possuía partes de texto.',
          recoverySuggestion: 'Reformule a pergunta de forma mais específica ou tente novamente.',
        });
      }

      const parsed = parseStructuredTutorJson(rawText);
      return {
        ...parsed,
        originMode: `gemini (${modelName})`,
        isCorrected: false,
        correctionData: null,
      };
    } catch (err) {
      if (err instanceof TutorDiagnosticError) {
        throw err;
      }
      lastError = err;
    }
  }

  throw new TutorDiagnosticError({
    code: 'NETWORK_ERROR',
    title: 'Falha de conexão com a internet ou API',
    userMessage:
      'Não foi possível conectar ao servidor do Google Gemini. Verifique sua conexão Wi-Fi/Dados.',
    technicalDetail: lastError?.message || 'Erro de rede desconhecido',
    recoverySuggestion:
      'Verifique a internet e toque em "Tentar Novamente", ou toque em "Gerar Resposta Demonstrativa" para testar os recursos de IHC offline.',
  });
}

/**
 * Faz o parse resiliente do JSON retornado pelo Gemini, garantindo que todos os campos de IHC existam.
 */
function parseStructuredTutorJson(rawText) {
  let clean = rawText.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  let obj;
  try {
    obj = JSON.parse(clean);
  } catch {
    return {
      answer: clean,
      confidenceScore: 65,
      confidenceLevel: 'media',
      confidenceJustification:
        'O modelo retornou uma resposta textual livre sem metadados estruturados completos.',
      reasoningSteps: [
        'Geração direta de resposta pelo modelo Gemini.',
        'Estruturação automática de fallback pela camada de interface.',
      ],
      limitations: 'Verifique as informações com a bibliografia da disciplina.',
      sources: [
        {
          title: 'Inferência Geral do Modelo Gemini',
          authorOrOrigin: 'Google Gemini API',
          type: 'Inferência do Modelo',
          snippet: 'Resposta gerada sem citação estruturada explícita.',
        },
      ],
    };
  }

  const score = Math.max(0, Math.min(100, Number(obj.confidenceScore) || 75));
  let level = (obj.confidenceLevel || '').toLowerCase();
  if (!['alta', 'media', 'baixa'].includes(level)) {
    level = score >= 80 ? 'alta' : score >= 50 ? 'media' : 'baixa';
  }

  const sources =
    Array.isArray(obj.sources) && obj.sources.length > 0
      ? obj.sources.map((s) => ({
          title: s.title || 'Referência Acadêmica',
          authorOrOrigin: s.authorOrOrigin || 'Literatura da Área',
          type: s.type || 'Bibliografia Acadêmica',
          snippet: s.snippet || 'Conceito utilizado na fundamentação da resposta.',
        }))
      : [
          {
            title: 'Base de Conhecimento do Modelo',
            authorOrOrigin: 'Google Gemini',
            type: 'Inferência do Modelo',
            snippet: 'Resposta sintetizada a partir do treinamento geral do modelo.',
          },
        ];

  const reasoningSteps =
    Array.isArray(obj.reasoningSteps) && obj.reasoningSteps.length > 0
      ? obj.reasoningSteps
      : [
          'Análise semântica dos termos-chave da pergunta do aluno.',
          'Recuperação de conceitos e referências da literatura.',
          'Avaliação do grau de certeza e possíveis ambiguidades.',
        ];

  return {
    answer: obj.answer || 'Não foi possível sintetizar uma resposta.',
    confidenceScore: score,
    confidenceLevel: level,
    confidenceJustification:
      obj.confidenceJustification ||
      `Nível de confiança calculado em ${score}% com base na especificidade da pergunta e na disponibilidade de fontes diretas.`,
    reasoningSteps,
    limitations:
      obj.limitations ||
      'Recomenda-se contrastar esta explicação com o material didático oficial da disciplina.',
    sources,
  };
}

/**
 * Gera uma resposta demonstrativa rica (Modo de Contingência / Simulação)
 * para garantir que o aluno possa demonstrar todos os conceitos de IHC mesmo sem internet ou sem chave.
 */
export function generateContingencyResponse(question, savedCorrections = []) {
  const matchedCorrection = findMatchingCorrection(question, savedCorrections);
  if (matchedCorrection) {
    return {
      answer: matchedCorrection.correctedAnswer,
      confidenceScore: 100,
      confidenceLevel: 'validada',
      confidenceJustification: `Resposta recuperada da Base Local de Correções do Aluno (${matchedCorrection.errorCategory}).`,
      reasoningSteps: [
        'Verificação na memória persistente local (AsyncStorage).',
        'Substituição da resposta padrão pela revisão validada pelo aluno.',
      ],
      limitations: 'Baseado na correção manual salva neste dispositivo.',
      sources: [
        {
          title: matchedCorrection.studentSource || 'Correção Registrada pelo Aluno',
          authorOrOrigin: 'Aluno (Human-in-the-Loop)',
          type: 'Correção do Aluno',
          snippet: `Correção aplicada para a questão: "${matchedCorrection.question}"`,
        },
      ],
      originMode: 'memory_correction',
      isCorrected: true,
      correctionData: matchedCorrection,
      originalAiAnswer: matchedCorrection.originalAiAnswer,
    };
  }

  const qLower = question.toLowerCase();

  if (qLower.includes('nielsen') || qLower.includes('heuristica') || qLower.includes('heurística')) {
    return {
      answer:
        'As 10 Heurísticas de Usabilidade de Jakob Nielsen (1994) são princípios gerais para design de interação usados na Avaliação Heurística para identificar problemas de usabilidade:\n\n' +
        '1. Visibilidade do status do sistema (feedback claro e contínuo)\n' +
        '2. Correspondência entre o sistema e o mundo real (linguagem do usuário)\n' +
        '3. Controle e liberdade do usuário (saídas de emergência, desfazer/refazer)\n' +
        '4. Consistência e padrões (convenções de plataforma)\n' +
        '5. Prevenção de erros (evitar que a falha ocorra antes da ação)\n' +
        '6. Reconhecimento em vez de memorização (reduzir carga cognitiva)\n' +
        '7. Flexibilidade e eficiência de uso (atalhos para experientes)\n' +
        '8. Estética e design minimalista (sem ruído visual irrelevante)\n' +
        '9. Auxílio para reconhecer, diagnosticar e recuperar-se de erros\n' +
        '10. Ajuda e documentação',
      confidenceScore: 95,
      confidenceLevel: 'alta',
      confidenceJustification:
        'Alta confiança (95%) porque as 10 Heurísticas de Nielsen são um padrão canônico e amplamente documentado na literatura de IHC desde 1994.',
      reasoningSteps: [
        'Identificação do conceito clássico de Avaliação Heurística em IHC.',
        'Mapeamento direto das 10 heurísticas revisadas por Jakob Nielsen (1994).',
        'Associação com exemplos práticos de feedback e prevenção de erros.',
      ],
      limitations:
        'As heurísticas gerais de Nielsen foram criadas para interfaces tradicionais; para sistemas baseados em IA, recomenda-se combiná-las com as 18 Diretrizes de Interação Humano-IA (Amershi et al., 2019).',
      sources: [
        {
          title: 'Usability Engineering / 10 Usability Heuristics for User Interface Design',
          authorOrOrigin: 'Jakob Nielsen (1994) - Nielsen Norman Group',
          type: 'Bibliografia Acadêmica',
          snippet: 'Definição original das 10 heurísticas para inspeção de usabilidade.',
        },
        {
          title: 'Interação Humano-Computador e Experiência do Usuário',
          authorOrOrigin: 'Simone Diniz Junqueira Barbosa & Bruno Santana da Silva',
          type: 'Livro-Texto de IHC',
          snippet: 'Capítulos sobre Avaliação de IHC e métodos de inspeção por especialistas.',
        },
      ],
      originMode: 'contingency_demo',
      isCorrected: false,
      correctionData: null,
    };
  }

  if (qLower.includes('fitts') || qLower.includes('menor') || qLower.includes('distante')) {
    return {
      answer:
        'Atenção à premissa da questão: A afirmação na pergunta parece inverter a relação matemática da Lei de Fitts (1954).\n\n' +
        'Em minha análise preliminar (com baixa confiança devido à contradição detectada na pergunta): na verdade, a Lei de Fitts modela que o tempo necessário para apontar para um alvo depende da distância (D) até o alvo e do tamanho/largura (W) do alvo: quanto maior e mais próximo o botão, menor o índice de dificuldade e mais rápido o clique.\n\n' +
        'Se desejar registrar a formulação exata adotada pelo seu professor (ex: equação de Shannon ID = log2(D/W + 1)), toque em "Corrigir Resposta" abaixo.',
      confidenceScore: 34,
      confidenceLevel: 'baixa',
      confidenceJustification:
        'Baixa confiança (34%) detectada propositalmente: a pergunta contém uma premissa contraditória com a literatura clássica de controle motor humano, exigindo validação ou correção do aluno.',
      reasoningSteps: [
        'Detecção de conflito entre a premissa da pergunta ("menor e mais distante = mais rápido") e o modelo preditivo de Paul Fitts (1954).',
        'Redução automática do indicador de confiança para alertar o estudante e evitar confiança cega.',
        'Convite explícito para revisão ou complementação humana (Human-in-the-Loop).',
      ],
      limitations:
        'A resposta não detalhou os coeficientes empíricos a e b da regressão linear MT = a + b * log2(2D/W). O aluno pode corrigir e complementar este ponto.',
      sources: [
        {
          title: 'The information capacity of the human motor system in controlling the amplitude of movement',
          authorOrOrigin: 'Paul M. Fitts (Journal of Experimental Psychology, 1954)',
          type: 'Artigo Científico',
          snippet: 'Demonstra que o tempo de movimento aumenta com a distância e diminui com a largura do alvo.',
        },
        {
          title: 'Fitts’s Law as a Research and Design Tool in Human-Computer Interaction',
          authorOrOrigin: 'I. Scott MacKenzie (1992)',
          type: 'Artigo Científico',
          snippet: 'Formulação de Shannon amplamente adotada em IHC: ID = log2(D/W + 1).',
        },
      ],
      originMode: 'contingency_demo',
      isCorrected: false,
      correctionData: null,
    };
  }

  return {
    answer:
      `Sobre a questão "${question}":\n\n` +
      'Em projetos de sistemas interativos e computação, não existe uma solução única universal sem considerar o contexto de uso, o perfil dos usuários (iniciantes vs. especialistas, necessidades de acessibilidade) e a tarefa principal.\n\n' +
      'A abordagem recomendada pela Engenharia de Usabilidade e pelo Design Centrado no Usuário (ISO 9241-210) consiste em:\n' +
      '1. Levantar requisitos e conhecer as limitações cognitivas/físicas do público-alvo;\n' +
      '2. Criar protótipos de baixa e alta fidelidade;\n' +
      '3. Avaliar empiricamente com usuários reais e ajustar os pontos de falha.\n\n' +
      'Nota: Esta é uma resposta com confiança moderada por depender de variáveis de projeto. Você pode tocar em "Corrigir Resposta" para definir a resposta exata esperada na sua prova ou atividade.',
    confidenceScore: 62,
    confidenceLevel: 'media',
    confidenceJustification:
      'Confiança moderada (62%): a pergunta permite múltiplas respostas válidas dependendo do domínio de aplicação, do público-alvo e do critério adotado pelo professor.',
    reasoningSteps: [
      'Análise do escopo aberto da pergunta enviada pelo aluno.',
      'Identificação de que a resposta depende de variáveis contextuais (usuário, tarefa e ambiente).',
      'Atribuição de nível de confiança intermediário para incentivar leitura crítica e eventual personalização pelo aluno.',
    ],
    limitations:
      'Por ser uma síntese geral em modo de contingência, pode não contemplar definições específicas de uma subárea. Use o botão "Corrigir Resposta" para ensinar ao tutor a resposta exata.',
    sources: [
      {
        title: 'ISO 9241-210: Ergonomics of human-system interaction — Human-centred design',
        authorOrOrigin: 'International Organization for Standardization (ISO)',
        type: 'Norma Técnica de IHC',
        snippet: 'Estabelece que o design deve ser baseado na compreensão explícita de usuários, tarefas e ambientes.',
      },
      {
        title: 'Interaction Design: Beyond Human-Computer Interaction',
        authorOrOrigin: 'Sharp, Rogers & Preece',
        type: 'Bibliografia Acadêmica',
        snippet: 'Discute trade-offs de design e a impossibilidade de uma interface única ideal para todos os cenários.',
      },
    ],
    originMode: 'contingency_demo',
    isCorrected: false,
    correctionData: null,
  };
}
