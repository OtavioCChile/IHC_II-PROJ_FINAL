import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Componente de Explicabilidade (XAI - Explainable AI)
 * Baseado na Diretriz G11 de Amershi et al. (2019):
 * "Make clear why the system did what it did"
 * e no padrão de IHC de Divulgação Progressiva (Progressive Disclosure),
 * apresentando as fontes imediatamente e permitindo inspecionar o raciocínio e limitações.
 */
export default function ExplainabilityCard({
  sources = [],
  reasoningSteps = [],
  limitations = '',
  isCorrected = false,
  originalAiAnswer = '',
  originMode = '',
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showOriginalAnswer, setShowOriginalAnswer] = useState(false);

  const getOriginLabel = () => {
    if (originMode === 'memory_correction' || isCorrected) {
      return 'Origem: Base Local de Correções do Aluno';
    }
    if (originMode === 'contingency_demo') {
      return 'Origem: Modo Demonstrativo / Contingência Local';
    }
    if (originMode === 'system') {
      return 'Origem: Guia do Sistema de IHC';
    }
    if (originMode.startsWith('gemini')) {
      return `Origem: API Google ${originMode}`;
    }
    return 'Origem: Tutor IA';
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.sourcesSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Fontes e Fundamentação ({sources.length})
          </Text>
          <Text style={styles.originTag}>{getOriginLabel()}</Text>
        </View>

        {sources.map((src, index) => {
          const isStudentSource =
            src.type?.toLowerCase().includes('aluno') ||
            src.authorOrOrigin?.toLowerCase().includes('human');

          return (
            <View
              key={`${src.title}-${index}`}
              style={[
                styles.sourceItem,
                isStudentSource && styles.studentSourceItem,
              ]}
            >
              <View style={styles.sourceTopRow}>
                <Text style={styles.sourceTitle} numberOfLines={2}>
                  {index + 1}. {src.title}
                </Text>
                {!!src.type && (
                  <View
                    style={[
                      styles.sourceTypeBadge,
                      isStudentSource && styles.studentSourceBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourceTypeText,
                        isStudentSource && styles.studentSourceBadgeText,
                      ]}
                    >
                      {src.type}
                    </Text>
                  </View>
                )}
              </View>

              {!!src.authorOrOrigin && (
                <Text style={styles.sourceAuthor}>Autor/Origem: {src.authorOrOrigin}</Text>
              )}

              {!!src.snippet && (
                <Text style={styles.sourceSnippet}>"{src.snippet}"</Text>
              )}
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.reasoningToggleBtn}
        activeOpacity={0.75}
        onPress={() => setShowReasoning((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Mostrar ou ocultar explicação do raciocínio da IA e limitações"
      >
        <Text style={styles.reasoningToggleText}>
          {showReasoning
            ? 'Ocultar raciocínio e limitações'
            : 'Como a IA pensou? (Ver Raciocínio e Limitações)'}
        </Text>
      </TouchableOpacity>

      {showReasoning && (
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningBoxHeader}>
            Passos do Raciocínio (Chain-of-Thought Simplificado):
          </Text>
          {reasoningSteps.map((step, idx) => (
            <View key={`step-${idx}`} style={styles.stepRow}>
              <Text style={styles.stepBullet}>{idx + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          {!!limitations && (
            <View style={styles.limitationsBox}>
              <Text style={styles.limitationsTitle}>
                Limitações e Escopo desta Resposta:
              </Text>
              <Text style={styles.limitationsText}>{limitations}</Text>
            </View>
          )}
        </View>
      )}

      {isCorrected && !!originalAiAnswer && (
        <View style={styles.comparisonContainer}>
          <TouchableOpacity
            style={styles.comparisonToggle}
            onPress={() => setShowOriginalAnswer((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Text style={styles.comparisonToggleText}>
              {showOriginalAnswer
                ? 'Ocultar resposta original da IA (antes da correção)'
                : 'Comparar com a resposta original da IA (antes da correção)'}
            </Text>
          </TouchableOpacity>

          {showOriginalAnswer && (
            <View style={styles.originalAnswerBox}>
              <Text style={styles.originalAnswerHeader}>
                Resposta anterior da IA (substituída pela correção do aluno):
              </Text>
              <Text style={styles.originalAnswerText}>{originalAiAnswer}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 6,
    gap: 8,
  },
  sourcesSection: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  originTag: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  sourceItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
    gap: 3,
  },
  studentSourceItem: {
    backgroundColor: '#EEF2FF',
    borderColor: '#A5B4FC',
  },
  sourceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  sourceTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  sourceTypeBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  studentSourceBadge: {
    backgroundColor: '#4F46E5',
  },
  sourceTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  studentSourceBadgeText: {
    color: '#FFFFFF',
  },
  sourceAuthor: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  sourceSnippet: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 16,
  },
  reasoningToggleBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reasoningToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  reasoningBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  reasoningBoxHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  stepBullet: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  limitationsBox: {
    marginTop: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    padding: 8,
    gap: 2,
  },
  limitationsTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  limitationsText: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
  },
  comparisonContainer: {
    marginTop: 2,
  },
  comparisonToggle: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  comparisonToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#3730A3',
  },
  originalAnswerBox: {
    marginTop: 6,
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#94A3B8',
    gap: 4,
  },
  originalAnswerHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  originalAnswerText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    textDecorationLine: 'line-through',
  },
});
