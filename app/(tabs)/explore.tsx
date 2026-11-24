import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { TabContent, useTabClearance } from '../../components/GlassTabBar';
import { Avatar, Button, Field, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { OutingType, photoList } from '../../db/model';
import { useOutingPages } from '../../db/useDiary';
import { t } from '../../i18n';
import { photoSource } from '../../services/photos';

export default function Explore() {
  const p = usePalette();
  const tabClearance = useTabClearance();
  const { width, fontScale } = useWindowDimensions();
  const twoRows = width / fontScale < 385;
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OutingType>();
  const [saved, setSaved] = useState(false);
  const { items, error, refreshing, load } = useOutingPages({ query, type, saved });
  return <TabContent name="explore">
    <Header title={t.explore} />
    <View style={{ padding: side, gap: 12 }}>
      <Field label={t.search} value={query} onChangeText={setQuery} placeholder={t.searchPlaceholder} returnKeyType="search" />
      <View style={[styles.row, !twoRows && { flexWrap: 'nowrap' }]}>
        <View style={[styles.columns, { flexGrow: 1, flexBasis: twoRows ? '100%' : 0 }]}>
          <Button label={t.all} stretch selected={!type && !saved} onPress={() => { setType(undefined); setSaved(false); }} />
          <Button label={t.fishing} stretch selected={type === 'fishing'} onPress={() => setType('fishing')} />
        </View>
        <View style={[styles.columns, { flexGrow: 1, flexBasis: twoRows ? '100%' : 0 }]}>
          <Button label={t.hike} stretch selected={type === 'hike'} onPress={() => setType('hike')} />
          <Button label={t.saved} stretch selected={saved} onPress={() => setSaved(!saved)} />
        </View>
      </View>
    </View>
    <FlatList data={items ?? []} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
      refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
      style={styles.screen} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingHorizontal: side, paddingBottom: tabClearance, gap: 12 }}
      ListEmptyComponent={error ? undefined : <Notice loading={refreshing || !items} message={refreshing || !items ? t.loading : query || saved || type ? t.noResults : t.empty} />}
      ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
      renderItem={({ item }) => {
        const photo = photoList(item)[0];
        return <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
          <Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 8,
            borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, borderRadius: 14 }}>
            {photo ? <Image source={photoSource(photo)} style={{ width: 56, height: 56, borderRadius: 8 }} /> : <Avatar size={56} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: p.ink, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: p.muted }}>{t[item.type]}</Text>
            </View>
          </Pressable>
        </Link>;
      }} />
  </TabContent>;
}
