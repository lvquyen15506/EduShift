import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function ActionButton({ title, onPress, secondary = false, disabled = false, busy = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress} style={[styles.button, secondary && styles.secondary, (disabled || busy) && styles.disabled]}>
    {busy ? <ActivityIndicator color={secondary ? colors.magenta : '#fff'} /> : <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>}
  </Pressable>;
}

export function LoadingView() {
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.magenta} /><Text style={styles.hint}>Đang tải dữ liệu...</Text></View>;
}

export function Notice({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return <View style={styles.notice}><Text style={styles.noticeTitle}>{title}</Text>{detail ? <Text style={styles.hint}>{detail}</Text> : null}{onRetry ? <ActionButton title="Thử lại" secondary onPress={onRetry} /> : null}</View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.magenta, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.blush },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryText: { color: colors.magenta },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  notice: { alignItems: 'center', gap: 12, padding: 24, margin: 18, borderRadius: 16, backgroundColor: colors.surface },
  noticeTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
