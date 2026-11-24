import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { outingTypes } from '../db/model';
import type { OutingType } from '../db/model';
import { t } from '../i18n';
import { brandGreen, onBrand, styles as ui, usePalette } from './ui';

type Option = OutingType | 'all';
type Props = { disabled?: boolean } & (
  | { mode?: 'choice'; value: OutingType; onChange: (value: OutingType) => void }
  | { mode: 'filter'; value: Option; onChange: (value: Option) => void }
);

const gap = 10;
const filterOptions: Option[] = ['all', ...outingTypes];

function FishingRod({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 21 19 4m0 0c-5 0-9 3-10 8m10-8v10m0 0v2.5a2.5 2.5 0 0 1-5 0V15"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function CategoryIcon({ option, color, size }: { option: Option; color: string; size: number }) {
  if (option === 'fishing') return <FishingRod size={size} color={color} />;
  if (option === 'both') return <View style={styles.iconPair}>
    <FishingRod size={size * 0.85} color={color} />
    <Ionicons name="bag-outline" size={size * 0.85} color={color} />
  </View>;
  return <Ionicons name={option === 'hike' ? 'bag-outline' : 'grid-outline'} size={size} color={color} />;
}

function CategoryCard({ option, selected, width, disabled, onPress }: {
  option: Option; selected: boolean; width?: number; disabled?: boolean; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    if (!selected) return;
    scale.value = withSequence(
      withTiming(0.97, { duration: 85, reduceMotion: ReduceMotion.System }),
      withTiming(1, { duration: 145, reduceMotion: ReduceMotion.System }),
    );
  }, [scale, selected]);
  const color = selected ? onBrand : brandGreen;
  return (
    <Animated.View style={[width == null ? styles.fill : { width }, motion]}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
        disabled={disabled} onPress={onPress}
        style={({ pressed }) => [styles.card, {
          backgroundColor: selected ? brandGreen : pressed ? '#E7F1EB' : '#FFFFFF',
          borderColor: selected ? brandGreen : '#D4DFD8',
        }]}>
        <CategoryIcon option={option} size={22} color={color} />
        <Text style={[styles.label, { color }]}>{t[option]}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function CategoryPicker(props: Props) {
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const filter = props.mode === 'filter';
  const choices = filter ? filterOptions : outingTypes;
  const cardWidth = filter ? Math.max(84 * fontScale, (width - gap * (choices.length - 1)) / choices.length) : undefined;
  const cards = choices.map((option) => (
    <CategoryCard key={option} option={option} selected={props.value === option} width={cardWidth}
      disabled={props.disabled} onPress={() => {
        if (props.mode === 'filter') props.onChange(option);
        else if (option !== 'all') props.onChange(option);
      }} />
  ));

  return (
    <View style={styles.picker} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <Text style={[ui.fieldLabel, { color: p.muted }]}>{t.category}</Text>
      {filter
        ? <ScrollView horizontal accessibilityRole="radiogroup" accessibilityLabel={t.category}
            keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}
            showsHorizontalScrollIndicator={false}>
            {cards}
          </ScrollView>
        : <View accessibilityRole="radiogroup" accessibilityLabel={t.category} style={styles.row}>{cards}</View>}
    </View>
  );
}

export function CategoryBadge({ type }: { type: OutingType }) {
  return <View style={styles.badge}>
    <CategoryIcon option={type} size={14} color={brandGreen} />
    <Text style={[styles.badgeLabel, { color: brandGreen }]}>{t[type]}</Text>
  </View>;
}

const styles = StyleSheet.create({
  picker: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap },
  fill: { flex: 1, minWidth: 0 },
  card: { flex: 1, minHeight: 68, borderWidth: 1, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 4,
    gap: 4, alignItems: 'center', justifyContent: 'center' },
  iconPair: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  label: { textAlign: 'center', fontSize: 13, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, gap: 4, backgroundColor: '#E7F1EB' },
  badgeLabel: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
