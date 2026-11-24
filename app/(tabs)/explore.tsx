import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabContent } from '../../components/GlassTabBar';
import { Avatar, bottomSpace, Button, Field, Header, Notice, side, styles, usePalette } from '../../components/ui';
import { OutingType, photoList } from '../../db/model';
import { useOutingPages } from '../../db/useDiary';
import { t } from '../../i18n';
import { photoSource } from '../../services/photos';

export default function Explore() {
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<OutingType>();
  const [saved, setSaved] = useState(false);
  const { items, error, refreshing, load } = useOutingPages({ query, type, saved });
  return <TabContent name="explore">
    <Header title={t.explore} />
    <View style={{ padding: side, gap: 12 }}>
      <Field label={t.search} value={query} onChangeText={setQuery} placeholder={t.searchPlaceholder} returnKeyType="search" />
      <View style={styles.row}>
        <Button label={t.all} selected={!type && !saved} onPress={() => { setType(undefined); setSaved(false); }} />
        <Button label={t.fishing} selected={type === 'fishing'} onPress={() => setType('fishing')} />
        <Button label={t.hike} selected={type === 'hike'} onPress={() => setType('hike')} />
        <Button label={t.saved} selected={saved} icon="bookmark-outline" onPress={() => setSaved(!saved)} />
      </View>
    </View>
    <FlatList data={items ?? []} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
      refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
      contentContainerStyle={{ paddingHorizontal: side, paddingBottom: bottomSpace + inset.bottom, gap: 9 }}
      ListEmptyComponent={error ? undefined : <Notice loading={refreshing || !items} message={refreshing || !items ? t.loading : query || saved || type ? t.noResults : t.empty} />}
      ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
      renderItem={({ item }) => {
        const photo = photoList(item)[0];
        return <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
          <Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 9,
            borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, borderRadius: 14 }}>
            {photo ? <Image source={photoSource(photo)} style={{ width: 62, height: 62, borderRadius: 9 }} /> : <Avatar />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: p.ink, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: p.muted }}>{t[item.type]}</Text>
            </View>
          </Pressable>
        </Link>;
      }} />
  </TabContent>;
}
