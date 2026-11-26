import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { PressFeedback as Pressable } from '../components/PressFeedback';
import { CategoryBadge, CategoryPicker } from '../components/CategoryPicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Field, Header, Notice, side, styles, usePalette } from '../components/ui';
import { OutingType, photoList } from '../db/model';
import { useOutingPages } from '../db/useDiary';
import { t } from '../i18n';
import { photoSource } from '../services/photos';

export default function DiarySearch() {
  const p = usePalette();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<OutingType | 'all'>('all');
  const [saved, setSaved] = useState(false);
  const { items, error, refreshing, load } = useOutingPages({ query, type: category === 'all' ? undefined : category, saved });
  return <>
    <Header title={t.searchDiary} back={() => router.canGoBack() ? router.back() : router.replace('/profile')} />
    <View style={{ padding: side, gap: 12 }}>
      <Field label={t.search} value={query} onChangeText={setQuery} placeholder={t.searchPlaceholder} returnKeyType="search" />
      <CategoryPicker mode="filter" value={category} onChange={setCategory} />
      <View style={styles.row}>
        <Button label={t.saved} icon="bookmark-outline" selected={saved} onPress={() => setSaved(!saved)} />
      </View>
    </View>
    <FlatList data={items ?? []} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled"
      refreshing={refreshing} onRefresh={() => void load(true)} onEndReached={() => void load(false)}
      style={styles.screen} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingHorizontal: side, paddingBottom: bottom + side, gap: 12 }}
      ListEmptyComponent={error ? undefined : <Notice loading={refreshing || !items} message={refreshing || !items ? t.loading : t.noCategoryResults} />}
      ListFooterComponent={error ? <Notice message={t.loadError} retry={() => void load(true)} /> : undefined}
      renderItem={({ item }) => {
        const photo = photoList(item)[0];
        return <Link href={{ pathname: '/outing/[id]', params: { id: item.id } }} asChild>
          <Pressable style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 8,
            borderWidth: 1, borderColor: p.line, backgroundColor: p.surface, borderRadius: 14 }}>
            {photo ? <Image source={photoSource(photo)} style={{ width: 56, height: 56, borderRadius: 8 }} /> : <Avatar size={56} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: p.ink, fontWeight: '700' }}>{item.title}</Text>
              <CategoryBadge type={item.type} />
            </View>
          </Pressable>
        </Link>;
      }} />
  </>;
}
