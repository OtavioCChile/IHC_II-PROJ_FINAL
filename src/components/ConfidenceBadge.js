import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Componente de Confiança Calibrada (IHC / Human-AI Interaction)
 * Baseado na Diretriz G2 de Amershi et al. (2019):
 * "Make clear how well the system can do what it can do."
 * Evita tanto a confiança cega (overtrust) quanto a desconfiança excessiva (undertrust).
 */
export default function ConfidenceBadge({
  score = 75,
  level = 'media',
  justification = '',
  isCorrected = false,
}) {
  const [showDetails, setShowDetails] = useState(level === 'baixa' || isCorrected);

  const getVisualConfig = () => {
    if (isCorrected || level === 'validada') {
      return {
        label: 'Nível de Confiança: Revisado pelo Aluno',
        badgeText: '100% Validado',
        dotColor: '#4F46E5',
        bg: '#EEF2FF',
        border: '#6366F1',
        text: '#312E81',
        barColor: '#4F46E5',
        advice:
          'Conhecimento corrigido e validado manualmente pelo estudante (Human-in-the-Loop).',
      };
    }

    if (level === 'alta' || score >= 80) {
      return {
        label: 'Nível de Confiança: Alta',
        badgeText: `${score}%`,
        dotColor: '#16A34A',
        bg: '#F0FDF4',
        border: '#22C55E',
        text: '#14532D',
        barColor: '#16A34A',
        advice:
          'Conceito bem fundamentado nas fontes listadas abaixo. Ainda assim, confira as referências.',
      };
    }

    if (level === 'media' || (score >= 50 && score < 80)) {
      return {
        label: 'Nível de Confiança: Média',
        badgeText: `${score}%`,
        dotColor: '#D97706',
        bg: '#FFFBEB',
        border: '#F59E0B',
        text: '#78350F',
        barColor: '#D97706',
        advice:
          'Resposta parcialmente dependente de contexto ou interpretação. Verifique as fontes ou corrija se necessário.',
      };
    }

    return {
      label: 'Nível de Confiança: Baixa (Atenção)',
      badgeText: `${score}%`,
      dotColor: '#DC2626',
      bg: '#FEF2F2',
      border: '#EF4444',
      text: '#7F1D1D',
      barColor: '#DC2626',
      advice:
        'Alerta de incerteza elevada. A questão pode conter premissa duvidosa ou ambiguidade. Recomendamos revisar ou corrigir esta resposta.',
    };
  };

  const config = getVisualConfig();
  const clampedWidth = isCorrected ? 100 : Math.max(8, Math.min(100, Number(score) || 50));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setShowDetails((prev) => !prev)}
        style={styles.headerRow}
        accessibilityRole="button"
        accessibilityLabel={`${config.label}, ${config.badgeText}. Toque para ver o motivo.`}
      >
        <View style={styles.titleGroup}>
          <View style={[styles.statusDot, { backgroundColor: config.dotColor }]} />
          <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
          <View style={[styles.scorePill, { backgroundColor: config.barColor }]}>
            <Text style={styles.scorePillText}>{config.badgeText}</Text>
          </View>
        </View>

        <Text style={[styles.toggleHint, { color: config.text }]}>
          {showDetails ? '[Ocultar motivo]' : '[Por que este nível?]'}
        </Text>
      </TouchableOpacity>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${clampedWidth}%`, backgroundColor: config.barColor },
          ]}
        />
      </View>

      {showDetails && (
        <View style={styles.detailsBox}>
          {!!justification && (
            <Text style={[styles.justificationText, { color: config.text }]}>
              <Text style={styles.boldLabel}>Motivo da estimativa: </Text>
              {justification}
            </Text>
          )}
          <Text style={[styles.adviceText, { color: config.text }]}>
            <Text style={styles.boldLabel}>Orientação de IHC (Confiança Calibrada): </Text>
            {config.advice}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  scorePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  scorePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleHint: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.85,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  detailsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 4,
  },
  justificationText: {
    fontSize: 12,
    lineHeight: 17,
  },
  adviceText: {
    fontSize: 11.5,
    lineHeight: 16,
    opacity: 0.9,
  },
  boldLabel: {
    fontWeight: '700',
  },
});
